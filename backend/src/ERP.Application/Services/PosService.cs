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

public class PosService(IErpDbContext db) : IPosService
{
    public async Task<IReadOnlyList<TerminalDto>> GetTerminalsAsync(CancellationToken cancellationToken = default)
    {
        return await db.Terminals
            .AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.Code)
            .Select(x => new TerminalDto(x.Id, x.Code, x.Name, x.WarehouseId, x.IsActive))
            .ToListAsync(cancellationToken);
    }

    public async Task<PosProductDto?> GetProductByBarcodeAsync(string barcode, CancellationToken cancellationToken = default)
    {
        return await db.Products
            .AsNoTracking()
            .Where(x => x.Barcode == barcode && x.IsActive)
            .Select(x => new PosProductDto(x.Id, x.Barcode, x.Name, x.SalePrice))
            .FirstOrDefaultAsync(cancellationToken);
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

            var now = DateTime.UtcNow;
            var sale = new Sale
            {
                Id = Guid.NewGuid(),
                SaleNo = $"POS-{now:yyyyMMddHHmmssfff}",
                CustomerId = request.CustomerId,
                TerminalId = request.TerminalId,
                CreatedAt = now
            };

            foreach (var item in request.Items)
            {
                if (item.Quantity <= 0)
                    throw new InvalidOperationException("Ürün miktarı sıfırdan büyük olmalıdır.");

                if (!productsById.TryGetValue(item.ProductId, out var product))
                    throw new InvalidOperationException($"Ürün bulunamadı veya aktif değil: {item.ProductId}");

                var unitPrice = product.SalePrice;
                var lineTotal = item.Quantity * unitPrice;

                sale.Items.Add(new SaleItem
                {
                    Id = Guid.NewGuid(),
                    SaleId = sale.Id,
                    ProductId = item.ProductId,
                    Quantity = item.Quantity,
                    UnitPrice = unitPrice,
                    DiscountAmount = 0,
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

                sale.TotalAmount += lineTotal;
            }

            sale.DiscountAmount = 0;
            sale.NetAmount = sale.TotalAmount;

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
