namespace ERP.Application.Dto;

// ─── Stok Özet Raporu ────────────────────────────────────────────────────────

public record StockSummaryReportDto(
    int TotalProductCount,
    int ActiveProductCount,
    decimal TotalStockValue,
    int CriticalStockCount,
    int OutOfStockCount,
    IReadOnlyList<WarehouseStockDistributionDto> WarehouseDistribution,
    IReadOnlyList<CriticalStockItemDto> CriticalStockItems);

public record WarehouseStockDistributionDto(
    Guid WarehouseId,
    string WarehouseName,
    int ProductCount,
    decimal TotalQuantity,
    decimal TotalValue);

public record CriticalStockItemDto(
    Guid ProductId,
    string ProductCode,
    string ProductName,
    string ProductBarcode,
    string WarehouseName,
    decimal CurrentQuantity,
    decimal MinStock,
    decimal StockRatio);

// ─── Stok Hareket Raporu ─────────────────────────────────────────────────────

public record StockMovementReportDto(
    DateTime StartDate,
    DateTime EndDate,
    int TotalMovementCount,
    decimal TotalInboundQuantity,
    decimal TotalOutboundQuantity,
    decimal NetQuantityChange,
    IReadOnlyList<MovementTypeSummaryDto> TypeSummaries,
    IReadOnlyList<StockMovementReportItemDto> Items);

public record MovementTypeSummaryDto(
    int TypeId,
    string TypeName,
    int Count,
    decimal TotalQuantity,
    decimal TotalValue);

public record StockMovementReportItemDto(
    Guid Id,
    string ProductCode,
    string ProductName,
    string ProductBarcode,
    string WarehouseName,
    int Type,
    string TypeName,
    decimal Quantity,
    decimal UnitPrice,
    decimal LineValue,
    string ReferenceType,
    bool IsCancelled,
    DateTime CreatedAt);

// ─── Düşük Stok Raporu ───────────────────────────────────────────────────────

public record LowStockReportDto(
    int TotalCount,
    int OutOfStockCount,
    int CriticalCount,
    int WarningCount,
    IReadOnlyList<LowStockItemDto> Items);

public record LowStockItemDto(
    Guid ProductId,
    string ProductCode,
    string ProductName,
    string ProductBarcode,
    string WarehouseName,
    decimal CurrentQuantity,
    decimal MinStock,
    decimal StockRatio,
    string AlertLevel);
