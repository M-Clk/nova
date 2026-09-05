namespace ERP.Application.Dto;

public record ProductDto(
    Guid Id,
    string Code,
    string Barcode,
    string Name,
    Guid BrandId,
    string BrandName,
    Guid CategoryId,
    string CategoryName,
    Guid UnitId,
    string UnitName,
    decimal PurchasePrice,
    decimal SalePrice,
    decimal MinStock,
    bool IsActive);

public record CreateProductRequest(
    string Code,
    string Barcode,
    string Name,
    Guid BrandId,
    Guid CategoryId,
    Guid UnitId,
    decimal PurchasePrice,
    decimal SalePrice,
    decimal MinStock);

public record UpdateProductRequest(
    string Code,
    string Barcode,
    string Name,
    Guid BrandId,
    Guid CategoryId,
    Guid UnitId,
    decimal PurchasePrice,
    decimal SalePrice,
    decimal MinStock,
    bool IsActive);

public record PaginatedListDto<T>(IReadOnlyList<T> Items, int TotalCount);

// ─── Bulk Price Update ────────────────────────────────────────────────────────

public record BulkPriceUpdateItem(
    Guid ProductId,
    decimal? PurchasePrice,
    decimal? SalePrice);

public record BulkPriceUpdateRequest(
    IReadOnlyList<BulkPriceUpdateItem> Items);

public record BulkPriceUpdateResult(
    int UpdatedCount,
    int FailedCount,
    Guid BatchId,
    IReadOnlyList<Guid> NotFoundIds);

// ─── Price History ────────────────────────────────────────────────────────────

public record PriceHistoryDto(
    Guid Id,
    Guid ProductId,
    string ProductName,
    string ProductCode,
    decimal OldPurchasePrice,
    decimal NewPurchasePrice,
    decimal OldSalePrice,
    decimal NewSalePrice,
    string ChangedBy,
    Guid BatchId,
    bool IsReverted,
    DateTime CreatedAt);

// ─── CSV Price Import ─────────────────────────────────────────────────────────

public record ImportPriceErrorRow(int RowNumber, string Reason);

public record ImportPriceResult(
    int UpdatedCount,
    int SkippedCount,
    int ErrorCount,
    Guid? BatchId,
    IReadOnlyList<ImportPriceErrorRow> Errors);
