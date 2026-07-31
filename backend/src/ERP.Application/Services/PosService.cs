using ERP.Application.Abstractions;
using ERP.Application.Dto;
using ERP.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ERP.Application.Services;

public interface IPosService
{
    Task<IReadOnlyList<TerminalDto>> GetTerminalsAsync(CancellationToken cancellationToken = default);
    Task<PosProductDto?> GetProductByBarcodeAsync(string barcode, CancellationToken cancellationToken = default);
    Task<PosCheckoutResult> CheckoutAsync(PosCheckoutRequest request, CancellationToken cancellationToken = default);
}

public class PosService(IErpDbContext db, IDiscountService discountService) : IPosService
{
    public async Task<IReadOnlyList<TerminalDto>> GetTerminalsAsync(CancellationToken cancellationToken = default)
    {
        return await db.Terminals
            .AsNoTracking()
            .Include(x => x.Warehouse)
            .Where(x => x.IsActive)
            .OrderBy(x => x.Code)
            .Select(x => new TerminalDto(x.Id, x.Code, x.Name, x.WarehouseId, x.Warehouse != null ? x.Warehouse.Name : string.Empty, x.IsActive))
            .ToListAsync(cancellationToken);
    }

    public async Task<PosProductDto?> GetProductByBarcodeAsync(string barcode, CancellationToken cancellationToken = default)
    {
        var product = await db.Products
            .AsNoTracking()
            .Where(x => x.Barcode == barcode && x.IsActive)
            .FirstOrDefaultAsync(cancellationToken);

        if (product == null) return null;

        var discount = await discountService.GetApplicableDiscountForProductAsync(product, cancellationToken);

        return new PosProductDto(
            product.Id,
            product.Barcode,
            product.Name,
            product.SalePrice,
            discount?.DiscountedUnitPrice,
            discount?.DiscountName,
            discount?.DiscountPercentage);
    }

    public async Task<PosCheckoutResult> CheckoutAsync(PosCheckoutRequest request, CancellationToken cancellationToken = default)
    {
        if (request.Items.Count == 0)
            throw new InvalidOperationException("Sepet boş. En az bir ürün eklemelisiniz.");

        await using var transaction = await db.BeginTransactionAsync(cancellationToken);

        try
        {
            // Terminal doğrulama ve warehouse belirleme
            var terminal = await db.Terminals
                .FirstOrDefaultAsync(x => x.Id == request.TerminalId && x.IsActive, cancellationToken)
                ?? throw new InvalidOperationException($"Terminal bulunamadı veya aktif değil: {request.TerminalId}");

            var warehouseId = terminal.WarehouseId;

            // Müşteri doğrulama (opsiyonel)
            if (request.CustomerId.HasValue)
            {
                var customerExists = await db.Customers
                    .AnyAsync(x => x.Id == request.CustomerId.Value, cancellationToken);
                if (!customerExists)
                    throw new InvalidOperationException("Müşteri bulunamadı.");
            }

            // Ürünleri tek sorguda çek
            var productIds = request.Items.Select(x => x.ProductId).Distinct().ToArray();
            var productsById = await db.Products
                .Where(x => productIds.Contains(x.Id) && x.IsActive)
                .ToDictionaryAsync(x => x.Id, cancellationToken);

            // Ürün indirimlerini hesapla
            var productDiscounts = await discountService.GetApplicableDiscountsAsync(
                productsById.Values, cancellationToken);

            // Ara Toplam hesaplama (indirimli fiyatlar üzerinden) ve sepet indirimi doğrulama
            decimal totalGrossAmount = 0;  // Orijinal fiyatlar toplamı
            decimal totalAfterProductDiscount = 0;  // Ürün indirimi sonrası toplam

            foreach (var item in request.Items)
            {
                if (item.Quantity <= 0)
                    throw new InvalidOperationException("Ürün miktarı sıfırdan büyük olmalıdır.");

                if (!productsById.TryGetValue(item.ProductId, out var product))
                    throw new InvalidOperationException($"Ürün bulunamadı veya aktif değil: {item.ProductId}");

                var grossLineTotal = item.Quantity * product.SalePrice;
                totalGrossAmount += grossLineTotal;

                if (productDiscounts.TryGetValue(item.ProductId, out var discount))
                {
                    totalAfterProductDiscount += item.Quantity * discount.DiscountedUnitPrice;
                }
                else
                {
                    totalAfterProductDiscount += grossLineTotal;
                }
            }

            if (request.DiscountAmount < 0)
                throw new InvalidOperationException("İndirim tutarı sıfırdan küçük olamaz.");

            if (request.DiscountAmount > totalAfterProductDiscount)
                throw new InvalidOperationException("İndirim tutarı toplam tutardan büyük olamaz.");

            var now = DateTime.UtcNow;
            var sale = new Sale
            {
                Id = Guid.NewGuid(),
                SaleNo = $"POS-{now:yyyyMMddHHmmssfff}",
                CustomerId = request.CustomerId,
                TerminalId = request.TerminalId,
                CreatedAt = now
            };

            // Sepet indirimi dağıtımı için baz: ürün indirimi sonrası toplam
            decimal distributedCartDiscountSum = 0;
            int itemIndex = 0;
            int totalItems = request.Items.Count;

            foreach (var item in request.Items)
            {
                var product = productsById[item.ProductId];
                var unitPrice = product.SalePrice;
                var grossTotal = item.Quantity * unitPrice;

                // Ürün indirimi hesapla
                decimal productDiscountAmount = 0;
                Guid? discountId = null;
                if (productDiscounts.TryGetValue(item.ProductId, out var appliedDiscount))
                {
                    productDiscountAmount = Math.Round(appliedDiscount.DiscountAmountPerUnit * item.Quantity, 2);
                    discountId = appliedDiscount.DiscountId;
                }

                var afterProductDiscount = grossTotal - productDiscountAmount;

                // Sepet indirimi payını hesapla (ürün indirimi sonrası tutam üzerinden oransal)
                decimal cartDiscountShare = 0;
                if (totalAfterProductDiscount > 0 && request.DiscountAmount > 0)
                {
                    itemIndex++;
                    if (itemIndex == totalItems)
                    {
                        // Yuvarlama kuruş farkını son kaleme yansıt
                        cartDiscountShare = request.DiscountAmount - distributedCartDiscountSum;
                    }
                    else
                    {
                        cartDiscountShare = Math.Round(request.DiscountAmount * (afterProductDiscount / totalAfterProductDiscount), 2);
                        distributedCartDiscountSum += cartDiscountShare;
                    }
                }

                var lineTotal = grossTotal - productDiscountAmount - cartDiscountShare;

                sale.Items.Add(new SaleItem
                {
                    Id = Guid.NewGuid(),
                    SaleId = sale.Id,
                    ProductId = item.ProductId,
                    Quantity = item.Quantity,
                    UnitPrice = unitPrice,
                    DiscountId = discountId,
                    ProductDiscountAmount = productDiscountAmount,
                    DiscountAmount = cartDiscountShare,
                    LineTotal = lineTotal
                });

                db.StockMovements.Add(new StockMovement
                {
                    Id = Guid.NewGuid(),
                    ProductId = item.ProductId,
                    WarehouseId = warehouseId,
                    Type = StockMovementType.Sale,
                    Quantity = -item.Quantity,
                    UnitPrice = unitPrice,
                    ReferenceType = "PosSale",
                    ReferenceId = sale.Id,
                    CreatedAt = now
                });

                sale.TotalAmount += grossTotal;
                sale.DiscountAmount += productDiscountAmount + cartDiscountShare;
            }

            sale.NetAmount = sale.TotalAmount - sale.DiscountAmount;

            db.Sales.Add(sale);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return new PosCheckoutResult(sale.Id, sale.SaleNo, sale.TotalAmount, sale.NetAmount);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }
}
