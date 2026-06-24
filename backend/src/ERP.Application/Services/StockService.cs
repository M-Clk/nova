using ERP.Application.Abstractions;
using ERP.Application.Dto;
using Microsoft.EntityFrameworkCore;

namespace ERP.Application.Services;

public interface IStockService
{
    Task<IReadOnlyList<CurrentStockDto>> GetCurrentAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StockMovementDto>> GetMovementsAsync(CancellationToken cancellationToken = default);
}

public class StockService(IErpDbContext db) : IStockService
{
    public Task<IReadOnlyList<CurrentStockDto>> GetCurrentAsync(CancellationToken cancellationToken = default)
    {
        return db.StockMovements.AsNoTracking()
            .GroupBy(x => new
            {
                x.ProductId,
                ProductCode = x.Product != null ? x.Product.Code : string.Empty,
                ProductName = x.Product != null ? x.Product.Name : string.Empty,
                x.WarehouseId,
                WarehouseName = x.Warehouse != null ? x.Warehouse.Name : string.Empty
            })
            .Select(x => new CurrentStockDto(
                x.Key.ProductId,
                x.Key.ProductCode,
                x.Key.ProductName,
                x.Key.WarehouseId,
                x.Key.WarehouseName,
                x.Sum(m => m.Quantity)))
            .OrderBy(x => x.ProductName)
            .ToListAsync(cancellationToken)
            .ContinueWith<IReadOnlyList<CurrentStockDto>>(x => x.Result, cancellationToken);
    }

    public Task<IReadOnlyList<StockMovementDto>> GetMovementsAsync(CancellationToken cancellationToken = default)
    {
        return db.StockMovements.AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new StockMovementDto(
                x.Id,
                x.ProductId,
                x.Product != null ? x.Product.Code : string.Empty,
                x.Product != null ? x.Product.Name : string.Empty,
                x.WarehouseId,
                x.Warehouse != null ? x.Warehouse.Name : string.Empty,
                x.Type,
                x.Quantity,
                x.UnitPrice,
                x.ReferenceType,
                x.ReferenceId,
                x.CreatedAt))
            .ToListAsync(cancellationToken)
            .ContinueWith<IReadOnlyList<StockMovementDto>>(x => x.Result, cancellationToken);
    }
}
