using ERP.Application.Abstractions;
using ERP.Application.Dto;
using ERP.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ERP.Application.Services;

public interface ISaleService
{
    Task<IReadOnlyList<SaleDto>> GetAsync(CancellationToken cancellationToken = default);
    Task<SaleDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<SaleDto> CreateAsync(CreateSaleRequest request, CancellationToken cancellationToken = default);
}

public class SaleService(IErpDbContext db) : ISaleService
{
    public Task<IReadOnlyList<SaleDto>> GetAsync(CancellationToken cancellationToken = default)
    {
        return SaleQuery().OrderByDescending(x => x.CreatedAt).ToListAsync(cancellationToken)
            .ContinueWith<IReadOnlyList<SaleDto>>(x => x.Result, cancellationToken);
    }

    public Task<SaleDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return SaleQuery().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
    }

    public async Task<SaleDto> CreateAsync(CreateSaleRequest request, CancellationToken cancellationToken = default)
    {
        if (request.Items.Count == 0)
        {
            throw new InvalidOperationException("Sale must include at least one item.");
        }

        await using var transaction = await db.BeginTransactionAsync(cancellationToken);

        try
        {
            var warehouseId = request.WarehouseId ?? await db.Warehouses
                .OrderBy(x => x.Name)
                .Select(x => x.Id)
                .FirstAsync(cancellationToken);

            if (request.CustomerId.HasValue)
            {
                var customerExists = await db.Customers.AnyAsync(x => x.Id == request.CustomerId.Value, cancellationToken);
                if (!customerExists)
                {
                    throw new InvalidOperationException("Customer not found.");
                }
            }

            var productIds = request.Items.Select(x => x.ProductId).Distinct().ToArray();
            var productsById = await db.Products
                .Where(x => productIds.Contains(x.Id) && x.IsActive)
                .ToDictionaryAsync(x => x.Id, cancellationToken);

            var sale = new Sale
            {
                Id = Guid.NewGuid(),
                SaleNo = $"S-{DateTime.UtcNow:yyyyMMddHHmmssfff}",
                CustomerId = request.CustomerId,
                CreatedAt = DateTime.UtcNow
            };

            foreach (var itemRequest in request.Items)
            {
                if (itemRequest.Quantity <= 0)
                {
                    throw new InvalidOperationException("Sale item quantity must be greater than zero.");
                }

                if (!productsById.TryGetValue(itemRequest.ProductId, out var product))
                {
                    throw new InvalidOperationException($"Product not found or inactive: {itemRequest.ProductId}");
                }

                var unitPrice = itemRequest.UnitPrice ?? product.SalePrice;
                var grossTotal = itemRequest.Quantity * unitPrice;
                var lineTotal = grossTotal - itemRequest.DiscountAmount;

                if (lineTotal < 0)
                {
                    throw new InvalidOperationException("Line total cannot be negative.");
                }

                sale.Items.Add(new SaleItem
                {
                    Id = Guid.NewGuid(),
                    SaleId = sale.Id,
                    ProductId = itemRequest.ProductId,
                    Quantity = itemRequest.Quantity,
                    UnitPrice = unitPrice,
                    DiscountAmount = itemRequest.DiscountAmount,
                    LineTotal = lineTotal
                });

                db.StockMovements.Add(new StockMovement
                {
                    Id = Guid.NewGuid(),
                    ProductId = itemRequest.ProductId,
                    WarehouseId = warehouseId,
                    Type = StockMovementType.Sale,
                    Quantity = -itemRequest.Quantity,
                    UnitPrice = unitPrice,
                    ReferenceType = "Sale",
                    ReferenceId = sale.Id,
                    CreatedAt = sale.CreatedAt
                });

                sale.TotalAmount += grossTotal;
                sale.DiscountAmount += itemRequest.DiscountAmount;
            }

            sale.NetAmount = sale.TotalAmount - sale.DiscountAmount;
            db.Sales.Add(sale);

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return (await GetByIdAsync(sale.Id, cancellationToken))!;
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private IQueryable<SaleDto> SaleQuery()
    {
        return db.Sales.AsNoTracking()
            .Select(x => new SaleDto(
                x.Id,
                x.SaleNo,
                x.CustomerId,
                x.Customer != null ? x.Customer.Name : null,
                x.TotalAmount,
                x.DiscountAmount,
                x.NetAmount,
                x.CreatedAt,
                x.Items.Select(i => new SaleItemDto(
                    i.Id,
                    i.ProductId,
                    i.Product != null ? i.Product.Code : string.Empty,
                    i.Product != null ? i.Product.Name : string.Empty,
                    i.Quantity,
                    i.UnitPrice,
                    i.DiscountAmount,
                    i.LineTotal)).ToList()));
    }
}
