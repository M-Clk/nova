using ERP.Application.Abstractions;
using ERP.Application.Dto;
using ERP.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ERP.Application.Services;

public interface IStockReportService
{
    Task<StockSummaryReportDto> GetSummaryAsync(CancellationToken cancellationToken = default);

    Task<StockMovementReportDto> GetMovementReportAsync(
        DateTime? startDate,
        DateTime? endDate,
        Guid? warehouseId,
        Guid? productId,
        int? movementType,
        CancellationToken cancellationToken = default);

    Task<LowStockReportDto> GetLowStockAsync(CancellationToken cancellationToken = default);

    Task<ExportResult> ExportMovementsAsync(
        string format,
        DateTime? startDate,
        DateTime? endDate,
        Guid? warehouseId,
        Guid? productId,
        int? movementType,
        CancellationToken cancellationToken = default);
}

public class StockReportService(IErpDbContext db, IReportExporterFactory exporterFactory) : IStockReportService
{
    private static readonly Dictionary<int, string> MovementTypeNames = new()
    {
        [1] = "Alış",
        [2] = "Satış",
        [3] = "İade (Giriş)",
        [4] = "İade (Çıkış)",
        [5] = "Sayım",
        [6] = "Transfer (Giriş)",
        [7] = "Transfer (Çıkış)"
    };

    private static string GetTypeName(int type) =>
        MovementTypeNames.TryGetValue(type, out var name) ? name : $"Bilinmeyen ({type})";

    // ─── Stok Özet Raporu ────────────────────────────────────────────────────

    public async Task<StockSummaryReportDto> GetSummaryAsync(CancellationToken cancellationToken = default)
    {
        var totalProducts = await db.Products.CountAsync(cancellationToken);
        var activeProducts = await db.Products.CountAsync(p => p.IsActive, cancellationToken);

        // Group stock by product + warehouse
        var stockGroups = await db.StockMovements
            .AsNoTracking()
            .Where(x => !x.IsCancelled)
            .GroupBy(x => new { x.ProductId, x.WarehouseId })
            .Select(g => new
            {
                g.Key.ProductId,
                g.Key.WarehouseId,
                Quantity = g.Sum(m => m.Quantity),
                Value = g.Sum(m => m.Quantity * m.UnitPrice)
            })
            .ToListAsync(cancellationToken);

        // Resolve names
        var productIds = stockGroups.Select(g => g.ProductId).Distinct().ToList();
        var warehouseIds = stockGroups.Select(g => g.WarehouseId).Distinct().ToList();

        var products = await db.Products.AsNoTracking()
            .Where(p => productIds.Contains(p.Id))
            .Select(p => new { p.Id, p.Code, p.Name, p.Barcode, p.MinStock })
            .ToListAsync(cancellationToken);

        var warehouses = await db.Warehouses.AsNoTracking()
            .Where(w => warehouseIds.Contains(w.Id))
            .Select(w => new { w.Id, w.Name })
            .ToListAsync(cancellationToken);

        var productMap = products.ToDictionary(p => p.Id);
        var warehouseMap = warehouses.ToDictionary(w => w.Id);

        // Warehouse distribution
        var warehouseDistribution = stockGroups
            .GroupBy(g => g.WarehouseId)
            .Select(wg => new WarehouseStockDistributionDto(
                wg.Key,
                warehouseMap.TryGetValue(wg.Key, out var w) ? w.Name : string.Empty,
                wg.Select(x => x.ProductId).Distinct().Count(),
                wg.Sum(x => x.Quantity),
                wg.Sum(x => Math.Abs(x.Value))))
            .OrderBy(x => x.WarehouseName)
            .ToList();

        // Critical stock items
        var criticalItems = stockGroups
            .Where(g =>
            {
                if (!productMap.TryGetValue(g.ProductId, out var p)) return false;
                return g.Quantity <= p.MinStock;
            })
            .Select(g =>
            {
                var p = productMap[g.ProductId];
                return new CriticalStockItemDto(
                    g.ProductId,
                    p.Code,
                    p.Name,
                    p.Barcode,
                    warehouseMap.TryGetValue(g.WarehouseId, out var w) ? w.Name : string.Empty,
                    g.Quantity,
                    p.MinStock,
                    p.MinStock > 0 ? Math.Round(g.Quantity / p.MinStock * 100, 1) : 0);
            })
            .OrderBy(x => x.StockRatio)
            .ToList();

        var totalValue = stockGroups.Sum(g => Math.Abs(g.Value));
        var outOfStockCount = stockGroups.Count(g => g.Quantity <= 0);

        return new StockSummaryReportDto(
            totalProducts,
            activeProducts,
            totalValue,
            criticalItems.Count,
            outOfStockCount,
            warehouseDistribution,
            criticalItems);
    }

    // ─── Hareket Raporu ──────────────────────────────────────────────────────

    public async Task<StockMovementReportDto> GetMovementReportAsync(
        DateTime? startDate,
        DateTime? endDate,
        Guid? warehouseId,
        Guid? productId,
        int? movementType,
        CancellationToken cancellationToken = default)
    {
        var effectiveStart = startDate ?? DateTime.UtcNow.AddDays(-30);
        var effectiveEnd = endDate ?? DateTime.UtcNow;

        var query = BuildMovementQuery(effectiveStart, effectiveEnd, warehouseId, productId, movementType);

        var movements = await query
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new StockMovementReportItemDto(
                x.Id,
                x.Product != null ? x.Product.Code : string.Empty,
                x.Product != null ? x.Product.Name : string.Empty,
                x.Product != null ? x.Product.Barcode : string.Empty,
                x.Warehouse != null ? x.Warehouse.Name : string.Empty,
                (int)x.Type,
                string.Empty, // TypeName resolved in memory
                x.Quantity,
                x.UnitPrice,
                x.Quantity * x.UnitPrice,
                x.ReferenceType,
                x.IsCancelled,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

        // Resolve type names in memory
        var items = movements.Select(m => m with { TypeName = GetTypeName(m.Type) }).ToList();

        // Type summaries
        var typeSummaries = items
            .Where(x => !x.IsCancelled)
            .GroupBy(x => x.Type)
            .Select(g => new MovementTypeSummaryDto(
                g.Key,
                GetTypeName(g.Key),
                g.Count(),
                g.Sum(x => x.Quantity),
                g.Sum(x => Math.Abs(x.LineValue))))
            .OrderBy(x => x.TypeId)
            .ToList();

        var activeItems = items.Where(x => !x.IsCancelled).ToList();
        var totalInbound = activeItems.Where(x => x.Quantity > 0).Sum(x => x.Quantity);
        var totalOutbound = Math.Abs(activeItems.Where(x => x.Quantity < 0).Sum(x => x.Quantity));

        return new StockMovementReportDto(
            effectiveStart,
            effectiveEnd,
            items.Count,
            totalInbound,
            totalOutbound,
            totalInbound - totalOutbound,
            typeSummaries,
            items);
    }

    // ─── Düşük Stok Raporu ───────────────────────────────────────────────────

    public async Task<LowStockReportDto> GetLowStockAsync(CancellationToken cancellationToken = default)
    {
        var stockGroups = await db.StockMovements
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

        var productIds = stockGroups.Select(g => g.ProductId).Distinct().ToList();
        var warehouseIds = stockGroups.Select(g => g.WarehouseId).Distinct().ToList();

        var products = await db.Products.AsNoTracking()
            .Where(p => productIds.Contains(p.Id) && p.IsActive)
            .Select(p => new { p.Id, p.Code, p.Name, p.Barcode, p.MinStock })
            .ToListAsync(cancellationToken);

        var warehouses = await db.Warehouses.AsNoTracking()
            .Where(w => warehouseIds.Contains(w.Id))
            .Select(w => new { w.Id, w.Name })
            .ToListAsync(cancellationToken);

        var productMap = products.ToDictionary(p => p.Id);
        var warehouseMap = warehouses.ToDictionary(w => w.Id);

        var lowStockItems = stockGroups
            .Where(g =>
            {
                if (!productMap.TryGetValue(g.ProductId, out var p)) return false;
                return p.MinStock > 0 && g.Quantity <= p.MinStock * 1.2m; // 120% threshold for warning
            })
            .Select(g =>
            {
                var p = productMap[g.ProductId];
                var ratio = p.MinStock > 0 ? Math.Round(g.Quantity / p.MinStock * 100, 1) : 0;
                var alertLevel = g.Quantity <= 0 ? "out_of_stock"
                    : g.Quantity <= p.MinStock * 0.5m ? "critical"
                    : g.Quantity <= p.MinStock ? "low"
                    : "warning";

                return new LowStockItemDto(
                    g.ProductId,
                    p.Code,
                    p.Name,
                    p.Barcode,
                    warehouseMap.TryGetValue(g.WarehouseId, out var w) ? w.Name : string.Empty,
                    g.Quantity,
                    p.MinStock,
                    ratio,
                    alertLevel);
            })
            .OrderBy(x => x.StockRatio)
            .ToList();

        return new LowStockReportDto(
            lowStockItems.Count,
            lowStockItems.Count(x => x.AlertLevel == "out_of_stock"),
            lowStockItems.Count(x => x.AlertLevel == "critical"),
            lowStockItems.Count(x => x.AlertLevel == "warning"),
            lowStockItems);
    }

    // ─── Export ──────────────────────────────────────────────────────────────

    public async Task<ExportResult> ExportMovementsAsync(
        string format,
        DateTime? startDate,
        DateTime? endDate,
        Guid? warehouseId,
        Guid? productId,
        int? movementType,
        CancellationToken cancellationToken = default)
    {
        var report = await GetMovementReportAsync(startDate, endDate, warehouseId, productId, movementType, cancellationToken);

        var exporter = exporterFactory.GetExporter(format);

        var headers = new[]
        {
            "Tarih", "Ürün Kodu", "Ürün Adı", "Barkod", "Depo",
            "Hareket Tipi", "Miktar", "Birim Fiyat", "Tutar",
            "Referans", "Durum"
        };

        var rows = report.Items.Select(item => new[]
        {
            item.CreatedAt.ToString("dd.MM.yyyy HH:mm"),
            item.ProductCode,
            item.ProductName,
            item.ProductBarcode,
            item.WarehouseName,
            item.TypeName,
            item.Quantity.ToString("N2"),
            item.UnitPrice.ToString("N2"),
            item.LineValue.ToString("N2"),
            item.ReferenceType,
            item.IsCancelled ? "İptal" : "Aktif"
        });

        var content = exporter.Export(headers, rows);
        var fileName = $"stok_hareketleri_{DateTime.UtcNow:yyyyMMdd_HHmmss}{exporter.FileExtension}";

        return new ExportResult(content, exporter.ContentType, fileName);
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    private IQueryable<StockMovement> BuildMovementQuery(
        DateTime startDate, DateTime endDate,
        Guid? warehouseId, Guid? productId, int? movementType)
    {
        var query = db.StockMovements.AsNoTracking()
            .Where(x => x.CreatedAt >= startDate && x.CreatedAt <= endDate);

        if (warehouseId.HasValue)
            query = query.Where(x => x.WarehouseId == warehouseId.Value);

        if (productId.HasValue)
            query = query.Where(x => x.ProductId == productId.Value);

        if (movementType.HasValue)
            query = query.Where(x => (int)x.Type == movementType.Value);

        return query;
    }
}
