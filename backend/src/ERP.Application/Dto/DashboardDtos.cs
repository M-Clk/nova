namespace ERP.Application.Dto;

public record DashboardSummaryDto(
    decimal TotalNetSales,
    int TotalSalesCount,
    decimal TotalInventoryCost,
    decimal TotalStockQuantity,
    int TotalProductsCount,
    IReadOnlyList<DashboardSalesTrendPointDto> SalesTrend,
    IReadOnlyList<DashboardCategoryStockDto> CategoryStockDistribution,
    IReadOnlyList<DashboardTopProductDto> TopSellingProducts,
    IReadOnlyList<DashboardRecentSaleDto> RecentSales,
    IReadOnlyList<DashboardLowStockItemDto> LowStockAlerts,
    int LowStockCount
);

public record DashboardSalesTrendPointDto(string Label, decimal Amount);

public record DashboardCategoryStockDto(string Name, decimal Quantity, double Percentage);

public record DashboardTopProductDto(string Code, string Name, decimal Quantity, string UnitName, string CategoryName);

public record DashboardRecentSaleDto(
    Guid Id,
    string SaleNo,
    string? CustomerName,
    decimal NetAmount,
    decimal TotalAmount,
    decimal DiscountAmount,
    DateTime CreatedAt
);

public record DashboardLowStockItemDto(
    Guid Id,
    string Code,
    string Name,
    string CategoryName,
    string UnitName,
    decimal CurrentStock,
    decimal MinStock
);

