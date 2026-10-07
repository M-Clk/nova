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

// ─── Auto Categorization ──────────────────────────────────────────────────────

/// <summary>Bir ürün adı için üretilen kategori önerisi.</summary>
public record CategorySuggestionDto(
    string SuggestedCategoryName,
    double ConfidenceScore,
    string MatchedKeyword,
    Guid? SuggestedCategoryId);

/// <summary>Tekil ürün için öneri sonucu.</summary>
public record ProductSuggestionItem(
    Guid ProductId,
    string ProductCode,
    string ProductName,
    string CurrentCategoryName,
    CategorySuggestionDto? Suggestion);

/// <summary>Toplu öneri işlemi sonucu (önizleme, güncelleme yapmaz).</summary>
public record BulkSuggestionResult(
    int TotalProducts,
    int MatchedCount,
    int UnmatchedCount,
    IReadOnlyList<ProductSuggestionItem> Suggestions);

/// <summary>Toplu güncelleme uygulandıktan sonraki özet.</summary>
public record BulkCategoryUpdateResult(
    int UpdatedCount,
    int SkippedCount,
    int UnmatchedCount,
    IReadOnlyList<string> CreatedCategories);

/// <summary>Tekil kategori önerisi isteği.</summary>
public record SuggestCategoryRequest(string ProductName);

/// <summary>Toplu öneri / uygulama isteği.</summary>
/// <param name="ProductIds">Boş liste = tüm ürünler.</param>
/// <param name="OnlyUncategorized">true ise sadece "Genel" / null kategorisi değiştirilir.</param>
public record BulkCategorizationRequest(
    IReadOnlyList<Guid>? ProductIds,
    bool OnlyUncategorized = true);

// ─── Auto Brand Assignment ────────────────────────────────────────────────────

/// <summary>Bir ürün adı için üretilen marka önerisi.</summary>
public record BrandSuggestionDto(
    string SuggestedBrandName,
    double ConfidenceScore,
    string MatchedKeyword,
    Guid? SuggestedBrandId);

/// <summary>Tekil ürün için marka öneri sonucu.</summary>
public record ProductBrandSuggestionItem(
    Guid ProductId,
    string ProductCode,
    string ProductName,
    string CurrentBrandName,
    BrandSuggestionDto? Suggestion);

/// <summary>Toplu marka öneri işlemi sonucu (önizleme).</summary>
public record BulkBrandSuggestionResult(
    int TotalProducts,
    int MatchedCount,
    int UnmatchedCount,
    IReadOnlyList<ProductBrandSuggestionItem> Suggestions);

/// <summary>Toplu marka güncelleme uygulandıktan sonraki özet.</summary>
public record BulkBrandUpdateResult(
    int UpdatedCount,
    int SkippedCount,
    int UnmatchedCount,
    IReadOnlyList<string> CreatedBrands);

/// <summary>Tekil marka önerisi isteği.</summary>
public record SuggestBrandRequest(string ProductName);

/// <summary>Toplu marka öneri / uygulama isteği.</summary>
public record BulkBrandAssignmentRequest(
    IReadOnlyList<Guid>? ProductIds,
    bool OnlyUnbranded = true);

// ─── Bulk Product Import ──────────────────────────────────────────────────────

public record ProductImportPreviewItem(
    int RowNumber,
    string Code,
    string Barcode,
    string Name,
    string CategoryName,
    string? SuggestedCategoryName,
    string BrandName,
    string? SuggestedBrandName,
    string UnitCode,
    decimal PurchasePrice,
    decimal SalePrice,
    decimal MinStock,
    decimal InitialStock,
    string Status, // "New", "Existing", "Error"
    string? ErrorMessage);

public record ProductImportPreviewResult(
    int TotalRows,
    int NewCount,
    int ExistingCount,
    int ErrorCount,
    IReadOnlyList<ProductImportPreviewItem> Rows);

public record ProductImportRowItem(
    string Code,
    string Barcode,
    string Name,
    string? CategoryName,
    string? BrandName,
    string? UnitCode,
    decimal PurchasePrice,
    decimal SalePrice,
    decimal MinStock,
    decimal InitialStock);

public record ProductImportCommitRequest(
    string DuplicateAction, // "update", "skip", "fail"
    IReadOnlyList<ProductImportRowItem> Items);

public record ProductImportResult(
    int InsertedCount,
    int UpdatedCount,
    int SkippedCount,
    int TotalCount,
    Guid? BatchId);
