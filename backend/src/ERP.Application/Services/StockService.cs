using ERP.Application.Abstractions;
using ERP.Application.Dto;
using ERP.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ERP.Application.Services;

public interface IStockService
{
    Task<IReadOnlyList<CurrentStockDto>> GetCurrentAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StockMovementDto>> GetMovementsAsync(CancellationToken cancellationToken = default);
    Task<PaginatedListDto<StockMovementDto>> GetPagedMovementsAsync(
        int page,
        int pageSize,
        string? barcode,
        string? productName,
        string? warehouseName,
        string? movementType,
        string? movementStatus,
        CancellationToken cancellationToken = default);
    Task<StockMovementDto> AddMovementAsync(AddStockMovementRequest request, CancellationToken cancellationToken = default);
    Task CancelMovementAsync(Guid id, CancellationToken cancellationToken = default);
}

public class StockService(IErpDbContext db) : IStockService
{
    // Only inward types are allowed for manual entry
    private static readonly HashSet<int> AllowedManualTypes = [1, 3, 5, 6];

    public async Task<IReadOnlyList<CurrentStockDto>> GetCurrentAsync(CancellationToken cancellationToken = default)
    {
        // Group by IDs only (EF Core cannot evaluate navigation props inside GroupBy)
        var grouped = await db.StockMovements
            .AsNoTracking()
            .Where(x => !x.IsCancelled)
            .GroupBy(x => new { x.ProductId, x.WarehouseId })
            .Select(g => new
            {
                g.Key.ProductId,
                g.Key.WarehouseId,
                Quantity = g.Sum(m => m.Quantity)
            })
            .ToListAsync(cancellationToken);

        // Resolve names with separate lookups (executed as single queries)
        var productIds = grouped.Select(g => g.ProductId).Distinct().ToList();
        var warehouseIds = grouped.Select(g => g.WarehouseId).Distinct().ToList();

        var products = await db.Products
            .AsNoTracking()
            .Where(p => productIds.Contains(p.Id))
            .Select(p => new { p.Id, p.Code, p.Name, p.Barcode })
            .ToListAsync(cancellationToken);

        var warehouses = await db.Warehouses
            .AsNoTracking()
            .Where(w => warehouseIds.Contains(w.Id))
            .Select(w => new { w.Id, w.Name })
            .ToListAsync(cancellationToken);

        var productMap = products.ToDictionary(p => p.Id);
        var warehouseMap = warehouses.ToDictionary(w => w.Id);

        return grouped
            .Select(g => new CurrentStockDto(
                g.ProductId,
                productMap.TryGetValue(g.ProductId, out var p) ? p.Code : string.Empty,
                productMap.TryGetValue(g.ProductId, out var p2) ? p2.Name : string.Empty,
                productMap.TryGetValue(g.ProductId, out var p3) ? p3.Barcode : string.Empty,
                g.WarehouseId,
                warehouseMap.TryGetValue(g.WarehouseId, out var w) ? w.Name : string.Empty,
                g.Quantity))
            .OrderBy(x => x.ProductName)
            .ToList();
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
                x.Product != null ? x.Product.Barcode : string.Empty,
                x.WarehouseId,
                x.Warehouse != null ? x.Warehouse.Name : string.Empty,
                x.Type,
                x.Quantity,
                x.UnitPrice,
                x.ReferenceType,
                x.ReferenceId,
                x.IsCancelled,
                x.CreatedAt))
            .ToListAsync(cancellationToken)
            .ContinueWith<IReadOnlyList<StockMovementDto>>(x => x.Result, cancellationToken);
    }

    public async Task<PaginatedListDto<StockMovementDto>> GetPagedMovementsAsync(
        int page,
        int pageSize,
        string? barcode,
        string? productName,
        string? warehouseName,
        string? movementType,
        string? movementStatus,
        CancellationToken cancellationToken = default)
    {
        var query = db.StockMovements.AsNoTracking();

        // 1. Barcode filter
        if (!string.IsNullOrWhiteSpace(barcode))
        {
            var cleanBarcode = barcode.Trim().ToLower();
            query = query.Where(x => x.Product != null && x.Product.Barcode.ToLower().Contains(cleanBarcode));
        }

        // 2. Product name filter
        if (!string.IsNullOrWhiteSpace(productName))
        {
            var cleanName = productName.Trim().ToLower();
            query = query.Where(x => x.Product != null && x.Product.Name.ToLower().Contains(cleanName));
        }

        // 3. Warehouse name filter
        if (!string.IsNullOrWhiteSpace(warehouseName))
        {
            query = query.Where(x => x.Warehouse != null && x.Warehouse.Name == warehouseName);
        }

        // 4. Movement Type filter
        if (!string.IsNullOrWhiteSpace(movementType) && movementType != "all")
        {
            if (int.TryParse(movementType, out var typeInt))
            {
                query = query.Where(x => (int)x.Type == typeInt);
            }
        }

        // 5. Movement Status filter
        if (!string.IsNullOrWhiteSpace(movementStatus) && movementStatus != "all")
        {
            if (movementStatus == "cancelled")
            {
                query = query.Where(x => x.IsCancelled);
            }
            else if (movementStatus == "normal")
            {
                query = query.Where(x => !x.IsCancelled);
            }
        }

        var totalCount = await query.CountAsync(cancellationToken);

        query = query.OrderByDescending(x => x.CreatedAt);

        var items = await query.Select(x => new StockMovementDto(
                x.Id,
                x.ProductId,
                x.Product != null ? x.Product.Code : string.Empty,
                x.Product != null ? x.Product.Name : string.Empty,
                x.Product != null ? x.Product.Barcode : string.Empty,
                x.WarehouseId,
                x.Warehouse != null ? x.Warehouse.Name : string.Empty,
                x.Type,
                x.Quantity,
                x.UnitPrice,
                x.ReferenceType,
                x.ReferenceId,
                x.IsCancelled,
                x.CreatedAt))
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PaginatedListDto<StockMovementDto>(items, totalCount);
    }

    public async Task<StockMovementDto> AddMovementAsync(AddStockMovementRequest request, CancellationToken cancellationToken = default)
    {
        if (!AllowedManualTypes.Contains(request.Type))
            throw new InvalidOperationException($"Movement type {request.Type} cannot be added manually.");

        if (request.Quantity <= 0)
            throw new InvalidOperationException("Quantity must be greater than zero.");

        var product = await db.Products.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == request.ProductId && p.IsActive, cancellationToken)
            ?? throw new InvalidOperationException("Product not found or inactive.");

        var warehouse = await db.Warehouses.AsNoTracking()
            .FirstOrDefaultAsync(w => w.Id == request.WarehouseId, cancellationToken)
            ?? throw new InvalidOperationException("Warehouse not found.");

        var movement = new StockMovement
        {
            Id = Guid.NewGuid(),
            ProductId = request.ProductId,
            WarehouseId = request.WarehouseId,
            Type = (StockMovementType)request.Type,
            Quantity = request.Quantity,
            UnitPrice = request.UnitPrice,
            ReferenceType = "MANUAL",
            CreatedAt = DateTime.UtcNow
        };

        db.StockMovements.Add(movement);
        await db.SaveChangesAsync(cancellationToken);

        return new StockMovementDto(
            movement.Id,
            product.Id,
            product.Code,
            product.Name,
            product.Barcode,
            warehouse.Id,
            warehouse.Name,
            movement.Type,
            movement.Quantity,
            movement.UnitPrice,
            movement.ReferenceType,
            movement.ReferenceId,
            movement.IsCancelled,
            movement.CreatedAt);
    }

    public async Task CancelMovementAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var movement = await db.StockMovements
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("Stock movement not found.");

        if (movement.IsCancelled)
        {
            throw new InvalidOperationException("Stock movement is already cancelled.");
        }

        if (movement.ReferenceType != "MANUAL")
        {
            throw new InvalidOperationException("Only manually created stock movements can be cancelled directly.");
        }

        movement.IsCancelled = true;
        await db.SaveChangesAsync(cancellationToken);
    }
}

