using System.Globalization;
using ERP.Application.Abstractions;
using ERP.Application.Dto;
using Microsoft.EntityFrameworkCore;

namespace ERP.Application.Services;

public interface IDashboardService
{
    Task<DashboardSummaryDto> GetSummaryAsync(int period, bool isPrivileged, CancellationToken cancellationToken = default);
}

public class DashboardService(IErpDbContext db) : IDashboardService
{
    public async Task<DashboardSummaryDto> GetSummaryAsync(int period, bool isPrivileged, CancellationToken cancellationToken = default)
    {
        var periodDays = period switch
        {
            14 => 14,
            30 => 30,
            _ => 7
        };

        // 1. Total Product Count (Entire catalog)
        var totalProductsCount = await db.Products.CountAsync(cancellationToken);

        // 2. Active products and stock aggregation
        var productList = await db.Products
            .AsNoTracking()
            .Where(p => p.IsActive)
            .Select(p => new
            {
                p.Id,
                p.Code,
                p.Name,
                p.PurchasePrice,
                p.MinStock,
                CategoryName = p.Category != null ? p.Category.Name : "Diğer",
                UnitName = p.Unit != null ? p.Unit.Name : "Adet"
            })
            .ToListAsync(cancellationToken);

        var stockGroups = await db.StockMovements
            .AsNoTracking()
            .Where(x => !x.IsCancelled)
            .GroupBy(x => x.ProductId)
            .Select(g => new
            {
                ProductId = g.Key,
                Quantity = g.Sum(m => m.Quantity)
            })
            .ToListAsync(cancellationToken);

        var stockMap = stockGroups.ToDictionary(g => g.ProductId, g => g.Quantity);

        decimal totalStockQuantity = 0;
        decimal totalInventoryCost = 0;
        var categoryMap = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        var lowStockList = new List<DashboardLowStockItemDto>();

        foreach (var prod in productList)
        {
            stockMap.TryGetValue(prod.Id, out var qty);

            if (qty > 0)
            {
                totalStockQuantity += qty;
                totalInventoryCost += qty * prod.PurchasePrice;

                var catName = string.IsNullOrWhiteSpace(prod.CategoryName) ? "Diğer" : prod.CategoryName;
                categoryMap[catName] = categoryMap.GetValueOrDefault(catName) + qty;
            }

            if (prod.MinStock > 0 && qty < prod.MinStock)
            {
                lowStockList.Add(new DashboardLowStockItemDto(
                    prod.Id,
                    prod.Code,
                    prod.Name,
                    prod.CategoryName,
                    prod.UnitName,
                    qty,
                    prod.MinStock
                ));
            }
        }

        var totalCatQty = categoryMap.Values.Sum();
        var categoryStockDistribution = categoryMap
            .Select(kv => new DashboardCategoryStockDto(
                kv.Key,
                kv.Value,
                totalCatQty > 0 ? Math.Round((double)kv.Value / (double)totalCatQty * 100, 1) : 0))
            .OrderByDescending(x => x.Quantity)
            .Take(10)
            .ToList();

        var lowStockCount = lowStockList.Count;
        var lowStockAlerts = lowStockList
            .OrderBy(x => x.MinStock > 0 ? (x.CurrentStock / x.MinStock) : 0)
            .Take(10)
            .ToList();

        // 3. Financial and Sales Metrics (Admin / Manager only)
        decimal totalNetSales = 0m;
        int totalSalesCount = 0;
        var trendPoints = new List<DashboardSalesTrendPointDto>();
        var topSellingProducts = new List<DashboardTopProductDto>();
        var recentSales = new List<DashboardRecentSaleDto>();

        if (isPrivileged)
        {
            totalNetSales = await db.Sales.SumAsync(s => (decimal?)s.NetAmount, cancellationToken) ?? 0m;
            totalSalesCount = await db.Sales.CountAsync(cancellationToken);

            // Sales Trend
            var startDate = DateTime.UtcNow.Date.AddDays(-(periodDays - 1));
            var periodSales = await db.Sales
                .AsNoTracking()
                .Where(s => s.CreatedAt >= startDate)
                .Select(s => new { s.CreatedAt, s.NetAmount })
                .ToListAsync(cancellationToken);

            var trCulture = new CultureInfo("tr-TR");
            for (int i = 0; i < periodDays; i++)
            {
                var currentDate = startDate.AddDays(i);
                var dayTotal = periodSales
                    .Where(s => s.CreatedAt.Date == currentDate.Date)
                    .Sum(s => s.NetAmount);

                trendPoints.Add(new DashboardSalesTrendPointDto(currentDate.ToString("d MMM", trCulture), dayTotal));
            }

            // Top Selling Products
            var topProductGroups = await db.SaleItems
                .AsNoTracking()
                .GroupBy(i => i.ProductId)
                .Select(g => new
                {
                    ProductId = g.Key,
                    TotalQuantity = g.Sum(i => i.Quantity)
                })
                .OrderByDescending(x => x.TotalQuantity)
                .Take(5)
                .ToListAsync(cancellationToken);

            if (topProductGroups.Count > 0)
            {
                var topProductIds = topProductGroups.Select(x => x.ProductId).ToList();
                var topProductsInfo = await db.Products
                    .AsNoTracking()
                    .Where(p => topProductIds.Contains(p.Id))
                    .Select(p => new
                    {
                        p.Id,
                        p.Code,
                        p.Name,
                        UnitName = p.Unit != null ? p.Unit.Name : "Adet",
                        CategoryName = p.Category != null ? p.Category.Name : "Genel"
                    })
                    .ToListAsync(cancellationToken);

                var topProductsMap = topProductsInfo.ToDictionary(p => p.Id);

                topSellingProducts = topProductGroups
                    .Where(g => topProductsMap.ContainsKey(g.ProductId))
                    .Select(g =>
                    {
                        var info = topProductsMap[g.ProductId];
                        return new DashboardTopProductDto(
                            info.Code,
                            info.Name,
                            g.TotalQuantity,
                            info.UnitName,
                            info.CategoryName
                        );
                    })
                    .ToList();
            }

            // Recent Sales
            recentSales = await db.Sales
                .AsNoTracking()
                .OrderByDescending(s => s.CreatedAt)
                .Take(5)
                .Select(s => new DashboardRecentSaleDto(
                    s.Id,
                    s.SaleNo,
                    s.Customer != null ? s.Customer.Name : null,
                    s.NetAmount,
                    s.TotalAmount,
                    s.DiscountAmount,
                    s.CreatedAt
                ))
                .ToListAsync(cancellationToken);
        }

        return new DashboardSummaryDto(
            totalNetSales,
            totalSalesCount,
            totalInventoryCost,
            totalStockQuantity,
            totalProductsCount,
            trendPoints,
            categoryStockDistribution,
            topSellingProducts,
            recentSales,
            lowStockAlerts,
            lowStockCount
        );
    }
}

