using System.Text.Json;
using System.Text.RegularExpressions;
using ClosedXML.Excel;
using ERP.Application.Abstractions;
using ERP.Application.Dto;
using ERP.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ERP.Application.Services;

public interface IProductService
{
    Task<IReadOnlyList<ProductDto>> GetAsync(CancellationToken cancellationToken = default);
    Task<PaginatedListDto<ProductDto>> GetPagedAsync(int page, int pageSize, string? search, Guid? brandId, Guid? categoryId, bool? isActive, CancellationToken cancellationToken = default);
    Task<ProductDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ProductDto> CreateAsync(CreateProductRequest request, CancellationToken cancellationToken = default);
    Task<bool> UpdateAsync(Guid id, UpdateProductRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ExportResult> ExportProductsAsync(
        string? search,
        Guid? brandId,
        Guid? categoryId,
        bool? isActive,
        CancellationToken cancellationToken = default);
    Task<BulkPriceUpdateResult> BulkUpdatePricesAsync(BulkPriceUpdateRequest request, string changedBy, CancellationToken cancellationToken = default);
    Task<int> RevertBulkPriceUpdateAsync(Guid batchId, string revertedBy, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PriceHistoryDto>> GetRecentPriceHistoryAsync(int limit = 20, CancellationToken cancellationToken = default);
    Task<ImportPriceResult> ImportPricesFromExcelAsync(Stream xlsxStream, string changedBy, CancellationToken cancellationToken = default);

    // ─── Auto Categorization ─────────────────────────────────────────────────
    Task<CategorySuggestionDto?> SuggestCategoryAsync(string productName, CancellationToken cancellationToken = default);
    Task<BulkSuggestionResult> PreviewBulkCategorizationAsync(IReadOnlyList<Guid>? productIds, bool onlyUncategorized, CancellationToken cancellationToken = default);
    Task<BulkCategoryUpdateResult> ApplyBulkCategorizationAsync(IReadOnlyList<Guid>? productIds, bool onlyUncategorized, CancellationToken cancellationToken = default);

    // ─── Auto Brand Assignment ──────────────────────────────────────────────
    Task<BrandSuggestionDto?> SuggestBrandAsync(string productName, CancellationToken cancellationToken = default);
    Task<BulkBrandSuggestionResult> PreviewBulkBrandAssignmentAsync(IReadOnlyList<Guid>? productIds, bool onlyUnbranded, CancellationToken cancellationToken = default);
    Task<BulkBrandUpdateResult> ApplyBulkBrandAssignmentAsync(IReadOnlyList<Guid>? productIds, bool onlyUnbranded, CancellationToken cancellationToken = default);

    // ─── Product Import Settings ─────────────────────────────────────────────
    Task<ProductImportSettingsDto> GetImportSettingsAsync(CancellationToken cancellationToken = default);
    Task<ProductImportSettingsDto> UpdateImportSettingsAsync(UpdateProductImportSettingsRequest request, CancellationToken cancellationToken = default);

    // ─── Bulk Product Import ──────────────────────────────────────────────────
    Task<byte[]> GenerateImportTemplateAsync(CancellationToken cancellationToken = default);
    Task<ProductImportPreviewResult> PreviewProductImportAsync(Stream xlsxStream, ProductImportPreviewOptions? options = null, CancellationToken cancellationToken = default);
    Task<ProductImportResult> CommitProductImportAsync(ProductImportCommitRequest request, string changedBy, CancellationToken cancellationToken = default);
}

public class ProductService(IErpDbContext db, IProductCategorizationDbService categorization, IProductBrandAssignmentDbService branding) : IProductService
{
    public Task<IReadOnlyList<ProductDto>> GetAsync(CancellationToken cancellationToken = default)
    {
        return ProductQuery(db.Products.AsNoTracking().OrderBy(x => x.Name)).ToListAsync(cancellationToken)
            .ContinueWith<IReadOnlyList<ProductDto>>(x => x.Result, cancellationToken);
    }

    public async Task<PaginatedListDto<ProductDto>> GetPagedAsync(
        int page,
        int pageSize,
        string? search,
        Guid? brandId,
        Guid? categoryId,
        bool? isActive,
        CancellationToken cancellationToken = default)
    {
        var query = db.Products.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var cleanSearch = search.Trim().ToLower();
            query = query.Where(x => 
                x.Code.ToLower().Contains(cleanSearch) || 
                x.Name.ToLower().Contains(cleanSearch) || 
                x.Barcode.ToLower().Contains(cleanSearch)
            );
        }

        if (brandId.HasValue)
        {
            query = query.Where(x => x.BrandId == brandId.Value);
        }

        if (categoryId.HasValue)
        {
            query = query.Where(x => x.CategoryId == categoryId.Value);
        }

        if (isActive.HasValue)
        {
            query = query.Where(x => x.IsActive == isActive.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        query = query.OrderBy(x => x.Name);

        var items = await ProductQuery(query)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PaginatedListDto<ProductDto>(items, totalCount);
    }

    public Task<ProductDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return ProductQuery(db.Products.AsNoTracking().Where(x => x.Id == id)).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<ProductDto> CreateAsync(CreateProductRequest request, CancellationToken cancellationToken = default)
    {
        await ValidateReferenceDataAsync(request.BrandId, request.CategoryId, request.UnitId, cancellationToken);

        var product = new Product
        {
            Id = Guid.NewGuid(),
            Code = request.Code.Trim(),
            Barcode = request.Barcode.Trim(),
            Name = request.Name.Trim(),
            BrandId = request.BrandId,
            CategoryId = request.CategoryId,
            UnitId = request.UnitId,
            PurchasePrice = request.PurchasePrice,
            SalePrice = request.SalePrice,
            MinStock = request.MinStock,
            IsActive = true
        };

        db.Products.Add(product);
        await db.SaveChangesAsync(cancellationToken);
        return (await GetByIdAsync(product.Id, cancellationToken))!;
    }

    public async Task<bool> UpdateAsync(Guid id, UpdateProductRequest request, CancellationToken cancellationToken = default)
    {
        var product = await db.Products.FindAsync([id], cancellationToken);
        if (product is null)
        {
            return false;
        }

        await ValidateReferenceDataAsync(request.BrandId, request.CategoryId, request.UnitId, cancellationToken);

        product.Code = request.Code.Trim();
        product.Barcode = request.Barcode.Trim();
        product.Name = request.Name.Trim();
        product.BrandId = request.BrandId;
        product.CategoryId = request.CategoryId;
        product.UnitId = request.UnitId;
        product.PurchasePrice = request.PurchasePrice;
        product.SalePrice = request.SalePrice;
        product.MinStock = request.MinStock;
        product.IsActive = request.IsActive;

        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var product = await db.Products.FindAsync([id], cancellationToken);
        if (product is null)
        {
            return false;
        }

        product.IsActive = false;
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<ExportResult> ExportProductsAsync(
        string? search,
        Guid? brandId,
        Guid? categoryId,
        bool? isActive,
        CancellationToken cancellationToken = default)
    {
        var query = db.Products.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var cleanSearch = search.Trim().ToLower();
            query = query.Where(x =>
                x.Code.ToLower().Contains(cleanSearch) ||
                x.Name.ToLower().Contains(cleanSearch) ||
                x.Barcode.ToLower().Contains(cleanSearch)
            );
        }

        if (brandId.HasValue)
            query = query.Where(x => x.BrandId == brandId.Value);

        if (categoryId.HasValue)
            query = query.Where(x => x.CategoryId == categoryId.Value);

        if (isActive.HasValue)
            query = query.Where(x => x.IsActive == isActive.Value);

        query = query.OrderBy(x => x.Name);

        var list = await ProductQuery(query).ToListAsync(cancellationToken);

        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Ürünler");

        // ── Başlık satırı ──────────────────────────────────────────────────────
        var headers = new[]
        {
            "Ürün Kodu", "Barkod", "Ürün Adı", "Marka", "Kategori",
            "Birim", "Alış Fiyatı", "Satış Fiyatı", "Min. Stok", "Durum"
        };

        for (int col = 1; col <= headers.Length; col++)
        {
            var cell = ws.Cell(1, col);
            cell.Value = headers[col - 1];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#4472C4");
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        }

        // ── Veri satırları ─────────────────────────────────────────────────────
        // Fiyat sütunları: G=7 (Alış), H=8 (Satış)
        const int colAlış = 7;
        const int colSatış = 8;

        for (int row = 0; row < list.Count; row++)
        {
            var item = list[row];
            int xlRow = row + 2; // başlık 1. satırda

            ws.Cell(xlRow, 1).Value = item.Code;

            // Barkod: metin olarak sakla (sayıya çevrilmesini önle)
            var barcodeCell = ws.Cell(xlRow, 2);
            barcodeCell.Value = item.Barcode ?? "";
            barcodeCell.Style.NumberFormat.NumberFormatId = 49; // @ — text

            ws.Cell(xlRow, 3).Value = item.Name;
            ws.Cell(xlRow, 4).Value = item.BrandName;
            ws.Cell(xlRow, 5).Value = item.CategoryName;
            ws.Cell(xlRow, 6).Value = item.UnitName;

            var alışCell = ws.Cell(xlRow, colAlış);
            alışCell.Value = (double)item.PurchasePrice;
            alışCell.Style.NumberFormat.Format = "#,##0.00";

            var satışCell = ws.Cell(xlRow, colSatış);
            satışCell.Value = (double)item.SalePrice;
            satışCell.Style.NumberFormat.Format = "#,##0.00";

            ws.Cell(xlRow, 9).Value = (double)item.MinStock;
            ws.Cell(xlRow, 10).Value = item.IsActive ? "Aktif" : "Pasif";
        }

        // ── Sütun genişlikleri ─────────────────────────────────────────────────
        ws.Columns().AdjustToContents();
        // Fiyat sütunlarının minimum genişliği
        if (ws.Column(colAlış).Width < 14) ws.Column(colAlış).Width = 14;
        if (ws.Column(colSatış).Width < 14) ws.Column(colSatış).Width = 14;

        // ── Freeze top row ─────────────────────────────────────────────────────
        ws.SheetView.FreezeRows(1);

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        var content = ms.ToArray();

        var fileName = $"urunler_{DateTime.UtcNow:yyyyMMdd_HHmmss}.xlsx";
        const string contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

        return new ExportResult(content, contentType, fileName);
    }

    private IQueryable<ProductDto> ProductQuery(IQueryable<Product> query)
    {
        return query.Select(x => new ProductDto(
                x.Id,
                x.Code,
                x.Barcode,
                x.Name,
                x.BrandId,
                x.Brand != null ? x.Brand.Name : string.Empty,
                x.CategoryId,
                x.Category != null ? x.Category.Name : string.Empty,
                x.UnitId,
                x.Unit != null ? x.Unit.Name : string.Empty,
                x.PurchasePrice,
                x.SalePrice,
                x.MinStock,
                x.IsActive));
    }

    private async Task ValidateReferenceDataAsync(Guid brandId, Guid categoryId, Guid unitId, CancellationToken cancellationToken)
    {
        var brandExists = await db.Brands.AnyAsync(x => x.Id == brandId, cancellationToken);
        var categoryExists = await db.Categories.AnyAsync(x => x.Id == categoryId, cancellationToken);
        var unitExists = await db.Units.AnyAsync(x => x.Id == unitId, cancellationToken);

        if (!brandExists || !categoryExists || !unitExists)
        {
            throw new InvalidOperationException("Brand, category and unit must exist before creating a product.");
        }
    }

    public async Task<BulkPriceUpdateResult> BulkUpdatePricesAsync(
        BulkPriceUpdateRequest request,
        string changedBy,
        CancellationToken cancellationToken = default)
    {
        var ids = request.Items.Select(x => x.ProductId).Distinct().ToList();
        var products = await db.Products
            .Where(x => ids.Contains(x.Id) && x.IsActive)
            .ToListAsync(cancellationToken);

        var productMap = products.ToDictionary(x => x.Id);
        var notFound = new List<Guid>();
        var batchId = Guid.NewGuid();

        foreach (var item in request.Items)
        {
            if (!productMap.TryGetValue(item.ProductId, out var product))
            {
                notFound.Add(item.ProductId);
                continue;
            }

            // Validate: fiyatlar negatif olamaz
            if (item.PurchasePrice.HasValue && item.PurchasePrice.Value < 0)
                throw new InvalidOperationException($"Alış fiyatı negatif olamaz: {product.Name}");
            if (item.SalePrice.HasValue && item.SalePrice.Value < 0)
                throw new InvalidOperationException($"Satış fiyatı negatif olamaz: {product.Name}");

            var history = new ERP.Domain.Entities.PriceHistory
            {
                Id = Guid.NewGuid(),
                ProductId = product.Id,
                OldPurchasePrice = product.PurchasePrice,
                OldSalePrice = product.SalePrice,
                NewPurchasePrice = item.PurchasePrice ?? product.PurchasePrice,
                NewSalePrice = item.SalePrice ?? product.SalePrice,
                ChangedBy = changedBy,
                BatchId = batchId,
                IsReverted = false,
                CreatedAt = DateTime.UtcNow
            };

            db.PriceHistories.Add(history);

            if (item.PurchasePrice.HasValue)
                product.PurchasePrice = item.PurchasePrice.Value;
            if (item.SalePrice.HasValue)
                product.SalePrice = item.SalePrice.Value;
        }

        var updatedCount = products.Count - notFound.Count;
        await db.SaveChangesAsync(cancellationToken);

        return new BulkPriceUpdateResult(updatedCount, notFound.Count, batchId, notFound);
    }

    public async Task<int> RevertBulkPriceUpdateAsync(
        Guid batchId,
        string revertedBy,
        CancellationToken cancellationToken = default)
    {
        var history = await db.PriceHistories
            .Where(x => x.BatchId == batchId && !x.IsReverted)
            .ToListAsync(cancellationToken);

        if (history.Count == 0)
            throw new InvalidOperationException("Bu batch ID'ye ait geri alınabilir kayıt bulunamadı.");

        var productIds = history.Select(x => x.ProductId).ToList();
        var products = await db.Products
            .Where(x => productIds.Contains(x.Id))
            .ToListAsync(cancellationToken);

        var productMap = products.ToDictionary(x => x.Id);

        foreach (var h in history)
        {
            if (productMap.TryGetValue(h.ProductId, out var product))
            {
                product.PurchasePrice = h.OldPurchasePrice;
                product.SalePrice = h.OldSalePrice;
                h.IsReverted = true;
            }
        }

        // Revert işlemini de audit log olarak kaydet (yeni bir batch ile)
        var revertBatchId = Guid.NewGuid();
        foreach (var h in history.Where(h => productMap.ContainsKey(h.ProductId)))
        {
            var product = productMap[h.ProductId];
            db.PriceHistories.Add(new ERP.Domain.Entities.PriceHistory
            {
                Id = Guid.NewGuid(),
                ProductId = h.ProductId,
                OldPurchasePrice = h.NewPurchasePrice,
                OldSalePrice = h.NewSalePrice,
                NewPurchasePrice = h.OldPurchasePrice,
                NewSalePrice = h.OldSalePrice,
                ChangedBy = $"{revertedBy} (geri alma — batch: {batchId})",
                BatchId = revertBatchId,
                IsReverted = false,
                CreatedAt = DateTime.UtcNow
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        return history.Count;
    }

    public async Task<IReadOnlyList<PriceHistoryDto>> GetRecentPriceHistoryAsync(
        int limit = 20,
        CancellationToken cancellationToken = default)
    {
        return await db.PriceHistories
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .Take(limit)
            .Select(x => new PriceHistoryDto(
                x.Id,
                x.ProductId,
                x.Product != null ? x.Product.Name : string.Empty,
                x.Product != null ? x.Product.Code : string.Empty,
                x.OldPurchasePrice,
                x.NewPurchasePrice,
                x.OldSalePrice,
                x.NewSalePrice,
                x.ChangedBy,
                x.BatchId,
                x.IsReverted,
                x.CreatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<ImportPriceResult> ImportPricesFromExcelAsync(
        Stream xlsxStream,
        string changedBy,
        CancellationToken cancellationToken = default)
    {
        var errors = new List<ImportPriceErrorRow>();

        // ── 1. Workbook'u aç ──────────────────────────────────────────────────
        XLWorkbook workbook;
        try
        {
            workbook = new XLWorkbook(xlsxStream);
        }
        catch (Exception ex)
        {
            return new ImportPriceResult(0, 0, 1, null,
                [new ImportPriceErrorRow(0, $"Excel dosyası açılamadı: {ex.Message}")]
            );
        }

        using (workbook)
        {
            var ws = workbook.Worksheets.FirstOrDefault();
            if (ws is null)
                return new ImportPriceResult(0, 0, 1, null,
                    [new ImportPriceErrorRow(0, "Excel dosyasında sayfa (worksheet) bulunamadı.")]
                );

            // ── 2. Başlık satırından kolon indekslerini bul ───────────────────
            // ClosedXML: satır/sütun 1-tabanlı
            var headerRow = ws.Row(1);
            int lastHeaderCol = ws.LastColumnUsed()?.ColumnNumber() ?? 0;

            int codeCol     = 0;
            int purchaseCol = 0;
            int saleCol     = 0;

            for (int col = 1; col <= lastHeaderCol; col++)
            {
                var headerVal = headerRow.Cell(col).GetString().Trim();
                if (headerVal.Equals("Ürün Kodu",    StringComparison.OrdinalIgnoreCase)) codeCol     = col;
                if (headerVal.Equals("Alış Fiyatı",  StringComparison.OrdinalIgnoreCase)) purchaseCol = col;
                if (headerVal.Equals("Satış Fiyatı", StringComparison.OrdinalIgnoreCase)) saleCol     = col;
            }

            if (codeCol == 0 || (purchaseCol == 0 && saleCol == 0))
                return new ImportPriceResult(0, 0, 1, null,
                    [new ImportPriceErrorRow(1, "Gerekli kolon bulunamadı: 'Ürün Kodu' ve 'Alış Fiyatı' / 'Satış Fiyatı' başlığı olmalıdır.")]
                );

            // ── 3. Veri satırlarını oku ───────────────────────────────────────
            int lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;
            var xlRows = new List<(int XlRow, string Code, decimal? Purchase, decimal? Sale)>();

            for (int xlRow = 2; xlRow <= lastRow; xlRow++)
            {
                var row = ws.Row(xlRow);

                // Boş satırları atla
                if (row.IsEmpty()) continue;

                var code = row.Cell(codeCol).GetString().Trim();
                if (string.IsNullOrEmpty(code))
                {
                    errors.Add(new ImportPriceErrorRow(xlRow, "Ürün Kodu boş."));
                    continue;
                }

                decimal? purchase = null;
                decimal? sale     = null;

                if (purchaseCol > 0)
                {
                    var cell = row.Cell(purchaseCol);
                    if (!cell.IsEmpty())
                    {
                        if (cell.TryGetValue(out double pDouble))
                            purchase = (decimal)pDouble;
                        else
                        {
                            var raw = cell.GetString().Trim().Replace(",", ".");
                            if (decimal.TryParse(raw, System.Globalization.NumberStyles.Any,
                                                 System.Globalization.CultureInfo.InvariantCulture, out var p))
                                purchase = p;
                            else
                                errors.Add(new ImportPriceErrorRow(xlRow, $"Alış fiyatı okunamadı: '{raw}'"));
                        }
                    }
                }

                if (saleCol > 0)
                {
                    var cell = row.Cell(saleCol);
                    if (!cell.IsEmpty())
                    {
                        if (cell.TryGetValue(out double sDouble))
                            sale = (decimal)sDouble;
                        else
                        {
                            var raw = cell.GetString().Trim().Replace(",", ".");
                            if (decimal.TryParse(raw, System.Globalization.NumberStyles.Any,
                                                 System.Globalization.CultureInfo.InvariantCulture, out var s))
                                sale = s;
                            else
                                errors.Add(new ImportPriceErrorRow(xlRow, $"Satış fiyatı okunamadı: '{raw}'"));
                        }
                    }
                }

                if (purchase.HasValue || sale.HasValue)
                    xlRows.Add((xlRow, code, purchase, sale));
            }

            if (xlRows.Count == 0)
                return new ImportPriceResult(0, 0, errors.Count, null, errors);

            // ── 4. Ürünleri DB'den tek sorguda çek ───────────────────────────
            var codes = xlRows.Select(r => r.Code).Distinct().ToList();
            var dbProducts = await db.Products
                .Where(x => codes.Contains(x.Code))
                .ToListAsync(cancellationToken);

            var productByCode = dbProducts.ToDictionary(p => p.Code, StringComparer.OrdinalIgnoreCase);

            // ── 5. Sadece değişen fiyatları güncelle ─────────────────────────
            var batchId    = Guid.NewGuid();
            int updated    = 0;
            int skipped    = 0;
            bool anyChange = false;

            foreach (var (xlRow, code, purchase, sale) in xlRows)
            {
                if (!productByCode.TryGetValue(code, out var product))
                {
                    errors.Add(new ImportPriceErrorRow(xlRow, $"Ürün bulunamadı: '{code}'"));
                    continue;
                }

                var newPurchase = purchase.HasValue && purchase.Value != product.PurchasePrice ? purchase : null;
                var newSale     = sale.HasValue     && sale.Value     != product.SalePrice     ? sale     : null;

                if (newPurchase is null && newSale is null)
                {
                    skipped++;
                    continue;
                }

                if (newPurchase.HasValue && newPurchase.Value < 0)
                {
                    errors.Add(new ImportPriceErrorRow(xlRow, "Alış fiyatı negatif olamaz."));
                    continue;
                }
                if (newSale.HasValue && newSale.Value < 0)
                {
                    errors.Add(new ImportPriceErrorRow(xlRow, "Satış fiyatı negatif olamaz."));
                    continue;
                }

                db.PriceHistories.Add(new ERP.Domain.Entities.PriceHistory
                {
                    Id               = Guid.NewGuid(),
                    ProductId        = product.Id,
                    OldPurchasePrice = product.PurchasePrice,
                    OldSalePrice     = product.SalePrice,
                    NewPurchasePrice = newPurchase ?? product.PurchasePrice,
                    NewSalePrice     = newSale     ?? product.SalePrice,
                    ChangedBy        = changedBy,
                    BatchId          = batchId,
                    CreatedAt        = DateTime.UtcNow
                });

                if (newPurchase.HasValue) product.PurchasePrice = newPurchase.Value;
                if (newSale.HasValue)     product.SalePrice     = newSale.Value;

                updated++;
                anyChange = true;
            }

            if (anyChange)
                await db.SaveChangesAsync(cancellationToken);

            return new ImportPriceResult(updated, skipped, errors.Count,
                anyChange ? batchId : null, errors);
        }
    }

    // ─── Auto Categorization ─────────────────────────────────────────────────

    public Task<CategorySuggestionDto?> SuggestCategoryAsync(
        string productName,
        CancellationToken cancellationToken = default)
        => categorization.SuggestAsync(productName, cancellationToken);

    public Task<BulkSuggestionResult> PreviewBulkCategorizationAsync(
        IReadOnlyList<Guid>? productIds,
        bool onlyUncategorized,
        CancellationToken cancellationToken = default)
        => categorization.PreviewBulkAsync(productIds, onlyUncategorized, cancellationToken);

    public Task<BulkCategoryUpdateResult> ApplyBulkCategorizationAsync(
        IReadOnlyList<Guid>? productIds,
        bool onlyUncategorized,
        CancellationToken cancellationToken = default)
        => categorization.ApplyBulkAsync(productIds, onlyUncategorized, cancellationToken);

    // ─── Auto Brand Assignment ────────────────────────────────────────────────

    public Task<BrandSuggestionDto?> SuggestBrandAsync(
        string productName,
        CancellationToken cancellationToken = default)
        => branding.SuggestAsync(productName, cancellationToken);

    public Task<BulkBrandSuggestionResult> PreviewBulkBrandAssignmentAsync(
        IReadOnlyList<Guid>? productIds,
        bool onlyUnbranded,
        CancellationToken cancellationToken = default)
        => branding.PreviewBulkAsync(productIds, onlyUnbranded, cancellationToken);

    public Task<BulkBrandUpdateResult> ApplyBulkBrandAssignmentAsync(
        IReadOnlyList<Guid>? productIds,
        bool onlyUnbranded,
        CancellationToken cancellationToken = default)
        => branding.ApplyBulkAsync(productIds, onlyUnbranded, cancellationToken);

    // ─── Bulk Product Import ──────────────────────────────────────────────────

    public Task<byte[]> GenerateImportTemplateAsync(CancellationToken cancellationToken = default)
    {
        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Ürünler");

        var headers = new[]
        {
            "Ürün Kodu *",
            "Barkod",
            "Ürün Adı *",
            "Kategori",
            "Marka",
            "Birim",
            "Alış Fiyatı",
            "Satış Fiyatı",
            "Kritik Stok",
            "Başlangıç Stoğu"
        };

        for (int i = 0; i < headers.Length; i++)
        {
            var cell = ws.Cell(1, i + 1);
            cell.Value = headers[i];
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#1E293B"); // Koyu Lacivert
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        }

        // Örnek Satır 1 (Kırtasiye)
        ws.Cell(2, 1).Value = "8690001234567";
        ws.Cell(2, 2).Value = "8690001234567";
        ws.Cell(2, 3).Value = "Faber-Castell Grip 2011 0.7mm Kalem";
        ws.Cell(2, 4).Value = "Kırtasiye";
        ws.Cell(2, 5).Value = "Faber-Castell";
        ws.Cell(2, 6).Value = "ADET";
        ws.Cell(2, 7).Value = 45.00;
        ws.Cell(2, 8).Value = 75.00;
        ws.Cell(2, 9).Value = 5;
        ws.Cell(2, 10).Value = 20;

        // Örnek Satır 2 (Kitap)
        ws.Cell(3, 1).Value = "9789750718533";
        ws.Cell(3, 2).Value = "9789750718533";
        ws.Cell(3, 3).Value = "Şeker Portakalı - Can Yayınları";
        ws.Cell(3, 4).Value = "Kitap";
        ws.Cell(3, 5).Value = "Can Yayınları";
        ws.Cell(3, 6).Value = "ADET";
        ws.Cell(3, 7).Value = 60.00;
        ws.Cell(3, 8).Value = 90.00;
        ws.Cell(3, 9).Value = 3;
        ws.Cell(3, 10).Value = 15;

        // Sayı formatları
        ws.Range("G2:H100").Style.NumberFormat.Format = "#,##0.00";
        ws.Range("I2:J100").Style.NumberFormat.Format = "#,##0";

        ws.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        return Task.FromResult(ms.ToArray());
    }

    // ─── Product Import Settings ─────────────────────────────────────────────

    private const string ImportSettingsKey = "ProductImportSettings";

    private sealed class ProductImportSettingsData
    {
        public Guid? DefaultCategoryId { get; set; }
        public Guid? DefaultBrandId { get; set; }
        public Guid? DefaultUnitId { get; set; }
        public decimal DefaultMinStock { get; set; } = 0;
        public decimal DefaultInitialStock { get; set; } = 0;
        public bool AutoCategoryEnabled { get; set; } = true;
        public bool AutoBrandEnabled { get; set; } = true;
        public bool SanitizeBarcode { get; set; } = true;
        public string PriceMappingMode { get; set; } = "SalePriceOnly";
    }

    public async Task<ProductImportSettingsDto> GetImportSettingsAsync(CancellationToken cancellationToken = default)
    {
        var setting = await db.SystemSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Key == ImportSettingsKey, cancellationToken);
        ProductImportSettingsData data = new();
        if (setting != null && !string.IsNullOrWhiteSpace(setting.Value))
        {
            try
            {
                data = JsonSerializer.Deserialize<ProductImportSettingsData>(setting.Value) ?? new();
            }
            catch
            {
                data = new();
            }
        }

        string? categoryName = null;
        if (data.DefaultCategoryId.HasValue)
        {
            var cat = await db.Categories.AsNoTracking().FirstOrDefaultAsync(c => c.Id == data.DefaultCategoryId.Value, cancellationToken);
            categoryName = cat?.Name;
        }

        string? brandName = null;
        if (data.DefaultBrandId.HasValue)
        {
            var br = await db.Brands.AsNoTracking().FirstOrDefaultAsync(b => b.Id == data.DefaultBrandId.Value, cancellationToken);
            brandName = br?.Name;
        }

        string? unitName = null;
        if (data.DefaultUnitId.HasValue)
        {
            var u = await db.Units.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.DefaultUnitId.Value, cancellationToken);
            unitName = u?.Name;
        }

        return new ProductImportSettingsDto(
            data.DefaultCategoryId,
            categoryName,
            data.DefaultBrandId,
            brandName,
            data.DefaultUnitId,
            unitName,
            data.DefaultMinStock,
            data.DefaultInitialStock,
            data.AutoCategoryEnabled,
            data.AutoBrandEnabled,
            data.SanitizeBarcode,
            data.PriceMappingMode ?? "SalePriceOnly");
    }

    public async Task<ProductImportSettingsDto> UpdateImportSettingsAsync(
        UpdateProductImportSettingsRequest request,
        CancellationToken cancellationToken = default)
    {
        var data = new ProductImportSettingsData
        {
            DefaultCategoryId = request.DefaultCategoryId,
            DefaultBrandId = request.DefaultBrandId,
            DefaultUnitId = request.DefaultUnitId,
            DefaultMinStock = Math.Max(0, request.DefaultMinStock),
            DefaultInitialStock = Math.Max(0, request.DefaultInitialStock),
            AutoCategoryEnabled = request.AutoCategoryEnabled,
            AutoBrandEnabled = request.AutoBrandEnabled,
            SanitizeBarcode = request.SanitizeBarcode,
            PriceMappingMode = request.PriceMappingMode ?? "SalePriceOnly"
        };

        var setting = await db.SystemSettings.FirstOrDefaultAsync(s => s.Key == ImportSettingsKey, cancellationToken);
        var json = JsonSerializer.Serialize(data);
        if (setting == null)
        {
            db.SystemSettings.Add(new SystemSetting
            {
                Id = Guid.NewGuid(),
                Key = ImportSettingsKey,
                Value = json
            });
        }
        else
        {
            setting.Value = json;
        }

        await db.SaveChangesAsync(cancellationToken);
        return await GetImportSettingsAsync(cancellationToken);
    }

    // ─── Bulk Product Import ──────────────────────────────────────────────────

    public async Task<ProductImportPreviewResult> PreviewProductImportAsync(
        Stream xlsxStream,
        ProductImportPreviewOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        var settings = await GetImportSettingsAsync(cancellationToken);
        bool sanitizeBarcode = options?.SanitizeBarcode ?? settings.SanitizeBarcode;

        XLWorkbook workbook;
        try
        {
            workbook = new XLWorkbook(xlsxStream);
        }
        catch (Exception ex)
        {
            return new ProductImportPreviewResult(0, 0, 0, 0, 1, null, [], [],
            [
                new ProductImportPreviewItem(0, "", "", "", "", null, "", null, "", 0, 0, null, null, 0, 0, "Error", $"Excel dosyası okunamadı: {ex.Message}")
            ]);
        }

        using (workbook)
        {
            // Dolu sayfaları bul
            var availableSheets = workbook.Worksheets
                .Where(w => w.Visibility == XLWorksheetVisibility.Visible && w.RangeUsed() != null)
                .Select(w => w.Name)
                .ToList();

            if (availableSheets.Count == 0)
            {
                return new ProductImportPreviewResult(0, 0, 0, 0, 1, null, [], [],
                [
                    new ProductImportPreviewItem(0, "", "", "", "", null, "", null, "", 0, 0, null, null, 0, 0, "Error", "Excel dosyasında dolu sayfa bulunamadı.")
                ]);
            }

            var sheetsToProcess = string.IsNullOrWhiteSpace(options?.SheetName)
                ? workbook.Worksheets.Where(w => availableSheets.Contains(w.Name)).ToList()
                : workbook.Worksheets.Where(w => string.Equals(w.Name, options.SheetName.Trim(), StringComparison.OrdinalIgnoreCase)).ToList();

            if (sheetsToProcess.Count == 0)
            {
                sheetsToProcess = [workbook.Worksheets.First(w => availableSheets.Contains(w.Name))];
            }

            // İlk sayfanın sütunlarını kullanıcı haritalama listesi için hazırla
            var primaryWs = sheetsToProcess[0];
            var primaryUsed = primaryWs.RangeUsed();
            var availableCols = new List<ImportColumnInfoDto>();
            var rawPreviewRows = new List<RawExcelRowDto>();
            if (primaryUsed != null)
            {
                int fCol = primaryUsed.FirstColumn().ColumnNumber();
                int lCol = primaryUsed.LastColumn().ColumnNumber();
                int totalR = primaryUsed.LastRow().RowNumber();
                for (int col = fCol; col <= lCol; col++)
                {
                    string colLetter = XLHelper.GetColumnLetterFromNumber(col);
                    string sampleVal = "";

                    // Örnek veriyi ilk 35 satırdan, tek hücreli afişleri atlayarak bul
                    for (int r = 1; r <= Math.Min(35, totalR); r++)
                    {
                        var row = primaryWs.Row(r);
                        if (row.CellsUsed().Count() <= 1 && totalR > 3) continue;

                        var cell = primaryWs.Cell(r, col);
                        var txt = cell.GetString().Trim();
                        if (string.IsNullOrEmpty(txt) && cell.IsMerged())
                        {
                            txt = cell.MergedRange()?.FirstCell().GetString().Trim() ?? "";
                        }

                        if (!string.IsNullOrEmpty(txt) && txt.Length < 60)
                        {
                            sampleVal = txt;
                            break;
                        }
                    }

                    availableCols.Add(new ImportColumnInfoDto(
                        col,
                        colLetter,
                        $"Sütun {colLetter}",
                        sampleVal));
                }

                // Orijinal Excel sayfasının ilk 60 satırını ham önizleme için topla
                int maxRawRows = Math.Min(60, totalR);
                for (int r = 1; r <= maxRawRows; r++)
                {
                    var cells = new List<string>();
                    for (int col = fCol; col <= lCol; col++)
                    {
                        var cell = primaryWs.Cell(r, col);
                        var txt = cell.GetString().Trim();
                        if (string.IsNullOrEmpty(txt) && cell.IsMerged())
                        {
                            txt = cell.MergedRange()?.FirstCell().GetString().Trim() ?? "";
                        }
                        cells.Add(txt);
                    }
                    rawPreviewRows.Add(new RawExcelRowDto(r, cells));
                }
            }

            // Otomatik Sütun Tespiti
            int barcodeCol = options?.BarcodeCol ?? 0;
            int nameCol = options?.NameCol ?? 0;
            int salePriceCol = options?.SalePriceCol ?? 0;
            int purchasePriceCol = options?.PurchasePriceCol ?? 0;

            if (barcodeCol == 0 || nameCol == 0 || salePriceCol == 0)
            {
                DetectColumnsFromSheet(primaryWs, ref barcodeCol, ref nameCol, ref salePriceCol, ref purchasePriceCol);
            }

            var detectedDto = new ProductImportDetectedColumnsDto(
                barcodeCol > 0 ? barcodeCol : null,
                nameCol > 0 ? nameCol : null,
                salePriceCol > 0 ? salePriceCol : null,
                purchasePriceCol > 0 ? purchasePriceCol : null);

            if (barcodeCol == 0 || nameCol == 0)
            {
                return new ProductImportPreviewResult(0, 0, 0, 0, 1, detectedDto, availableSheets, availableCols,
                [
                    new ProductImportPreviewItem(1, "", "", "", "", null, "", null, "", 0, 0, null, null, 0, 0, "Error", "Barkod veya Ürün Adı sütunu tespit edilemedi. Lütfen sütun seçimini kontrol ediniz.")
                ],
                string.IsNullOrWhiteSpace(options?.SheetName) ? null : options.SheetName,
                rawPreviewRows);
            }

            // Sistemdeki mevcut ürünleri çek
            var existingProducts = await db.Products
                .AsNoTracking()
                .Select(x => new { x.Id, x.Code, x.Barcode, x.Name, x.SalePrice, x.PurchasePrice, x.CategoryId, x.BrandId, x.UnitId })
                .ToListAsync(cancellationToken);

            var existingByBarcode = new Dictionary<string, (Guid Id, string Code, string Barcode, string Name, decimal SalePrice, decimal PurchasePrice)>(StringComparer.OrdinalIgnoreCase);
            var existingByCode = new Dictionary<string, (Guid Id, string Code, string Barcode, string Name, decimal SalePrice, decimal PurchasePrice)>(StringComparer.OrdinalIgnoreCase);

            foreach (var p in existingProducts)
            {
                var b = CleanBarcode(p.Barcode, true);
                if (!string.IsNullOrEmpty(b) && !existingByBarcode.ContainsKey(b))
                    existingByBarcode[b] = (p.Id, p.Code, p.Barcode, p.Name, p.SalePrice, p.PurchasePrice);

                var c = CleanBarcode(p.Code, true);
                if (!string.IsNullOrEmpty(c) && !existingByCode.ContainsKey(c))
                    existingByCode[c] = (p.Id, p.Code, p.Barcode, p.Name, p.SalePrice, p.PurchasePrice);
            }

            var seenBarcodesInBatch = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var items = new List<ProductImportPreviewItem>();
            int newCount = 0;
            int existingCount = 0;
            int unchangedCount = 0;
            int errorCount = 0;

            foreach (var ws in sheetsToProcess)
            {
                var range = ws.RangeUsed();
                if (range == null) continue;

                int firstR = range.FirstRow().RowNumber();
                int lastR = range.LastRow().RowNumber();

                // Başlık satırını bul ve veri satırlarını başlat
                int startRow = firstR + 1;
                for (int r = firstR; r <= Math.Min(firstR + 14, lastR); r++)
                {
                    var bVal = ws.Cell(r, barcodeCol).GetString().Trim().ToLowerInvariant();
                    if (bVal.Contains("bar") || bVal.Contains("isbn") || bVal.Contains("kod"))
                    {
                        startRow = r + 1;
                        break;
                    }
                }

                for (int r = startRow; r <= lastR; r++)
                {
                    var row = ws.Row(r);
                    if (row.IsEmpty()) continue;

                    var rawBarcode = GetCellRawString(row.Cell(barcodeCol));
                    var cleanBarcode = CleanBarcode(rawBarcode, sanitizeBarcode);
                    var name = row.Cell(nameCol).GetString().Trim();

                    decimal salePrice = salePriceCol > 0 ? ParseDecimalCell(row.Cell(salePriceCol)) : 0;
                    decimal purchasePrice = purchasePriceCol > 0 ? ParseDecimalCell(row.Cell(purchasePriceCol)) : 0;

                    // Eğer satış fiyatı boşsa ama alış/bayi fiyatı varsa fiyat moduna göre ata
                    if (salePrice <= 0 && purchasePrice > 0 && settings.PriceMappingMode == "PurchasePriceOnly")
                    {
                        salePrice = purchasePrice;
                    }

                    // Filtreleme: Ürün satırı olmayan (bölüm başlıkları, tek hücreli ara başlıklar, dipnotlar ve açıklamalar) satırları sessizce atla
                    if (IsNonProductRow(row, cleanBarcode, name, salePrice, purchasePrice))
                    {
                        continue;
                    }

                    // Hata Kontrolleri: Zorunlu alanlar (Barkod, Ürün Adı, Satış Fiyatı)
                    if (string.IsNullOrWhiteSpace(cleanBarcode))
                    {
                        items.Add(new ProductImportPreviewItem(r, "", "", name, "", null, "", null, "ADET", purchasePrice, salePrice, null, null, 0, 0, "Error", "Barkod / Kod eksik veya okunamadı. Sistemde işlem yapabilmek için barkod zorunludur.", ws.Name));
                        errorCount++;
                        continue;
                    }

                    if (string.IsNullOrWhiteSpace(name))
                    {
                        items.Add(new ProductImportPreviewItem(r, cleanBarcode, cleanBarcode, "", "", null, "", null, "ADET", purchasePrice, salePrice, null, null, 0, 0, "Error", "Ürün adı boş.", ws.Name));
                        errorCount++;
                        continue;
                    }

                    if (salePrice <= 0 && purchasePrice <= 0)
                    {
                        items.Add(new ProductImportPreviewItem(r, cleanBarcode, cleanBarcode, name, "", null, "", null, "ADET", purchasePrice, salePrice, null, null, 0, 0, "Error", "Satış fiyatı belirtilmemiş veya 0.", ws.Name));
                        errorCount++;
                        continue;
                    }

                    if (seenBarcodesInBatch.Contains(cleanBarcode))
                    {
                        items.Add(new ProductImportPreviewItem(r, cleanBarcode, cleanBarcode, name, "", null, "", null, "ADET", purchasePrice, salePrice, null, null, 0, 0, "Error", $"Dosya içinde mükerrer barkod ('{cleanBarcode}').", ws.Name));
                        errorCount++;
                        continue;
                    }
                    seenBarcodesInBatch.Add(cleanBarcode);

                    // Sistemde mevcut mu kontrolü
                    bool hasExisting = existingByBarcode.TryGetValue(cleanBarcode, out var existing) ||
                                       existingByCode.TryGetValue(cleanBarcode, out existing);

                    string? suggestedCat = null;
                    string? suggestedBr = null;

                    if (hasExisting)
                    {
                        bool saleChanged = Math.Abs(existing.SalePrice - salePrice) > 0.001m;
                        bool purchaseChanged = purchasePrice > 0 && Math.Abs(existing.PurchasePrice - purchasePrice) > 0.001m;

                        if (saleChanged || purchaseChanged)
                        {
                            var diffList = new List<string>();
                            if (saleChanged) diffList.Add($"Satış: ₺{existing.SalePrice:N2} ➔ ₺{salePrice:N2}");
                            if (purchaseChanged) diffList.Add($"Alış: ₺{existing.PurchasePrice:N2} ➔ ₺{purchasePrice:N2}");
                            var diffMsg = string.Join(" | ", diffList);

                            items.Add(new ProductImportPreviewItem(
                                RowNumber: r,
                                Code: cleanBarcode,
                                Barcode: cleanBarcode,
                                Name: name,
                                CategoryName: "",
                                SuggestedCategoryName: null,
                                BrandName: "",
                                SuggestedBrandName: null,
                                UnitCode: "ADET",
                                PurchasePrice: purchasePrice > 0 ? purchasePrice : existing.PurchasePrice,
                                SalePrice: salePrice > 0 ? salePrice : existing.SalePrice,
                                OldPurchasePrice: existing.PurchasePrice,
                                OldSalePrice: existing.SalePrice,
                                MinStock: 0,
                                InitialStock: 0,
                                Status: "Existing",
                                ErrorMessage: diffMsg,
                                SheetName: ws.Name
                            ));
                            existingCount++;
                        }
                        else
                        {
                            items.Add(new ProductImportPreviewItem(
                                RowNumber: r,
                                Code: cleanBarcode,
                                Barcode: cleanBarcode,
                                Name: name,
                                CategoryName: "",
                                SuggestedCategoryName: null,
                                BrandName: "",
                                SuggestedBrandName: null,
                                UnitCode: "ADET",
                                PurchasePrice: existing.PurchasePrice,
                                SalePrice: existing.SalePrice,
                                OldPurchasePrice: existing.PurchasePrice,
                                OldSalePrice: existing.SalePrice,
                                MinStock: 0,
                                InitialStock: 0,
                                Status: "Unchanged",
                                ErrorMessage: "Fiyat aynı, değişiklik yok.",
                                SheetName: ws.Name
                            ));
                            unchangedCount++;
                        }
                    }
                    else
                    {
                        // Yeni Ürün - Kategori ve Marka tespiti
                        if (settings.AutoCategoryEnabled)
                        {
                            var catRes = await categorization.SuggestAsync(name, cancellationToken);
                            suggestedCat = catRes?.SuggestedCategoryName;
                        }
                        if (string.IsNullOrEmpty(suggestedCat) && !string.IsNullOrEmpty(settings.DefaultCategoryName))
                        {
                            suggestedCat = settings.DefaultCategoryName;
                        }

                        if (settings.AutoBrandEnabled)
                        {
                            var brRes = await branding.SuggestAsync(name, cancellationToken);
                            suggestedBr = brRes?.SuggestedBrandName;
                        }
                        if (string.IsNullOrEmpty(suggestedBr) && !string.IsNullOrEmpty(settings.DefaultBrandName))
                        {
                            suggestedBr = settings.DefaultBrandName;
                        }

                        items.Add(new ProductImportPreviewItem(
                            RowNumber: r,
                            Code: cleanBarcode,
                            Barcode: cleanBarcode,
                            Name: name,
                            CategoryName: suggestedCat ?? "Genel",
                            SuggestedCategoryName: suggestedCat,
                            BrandName: suggestedBr ?? "Genel",
                            SuggestedBrandName: suggestedBr,
                            UnitCode: settings.DefaultUnitName ?? "ADET",
                            PurchasePrice: purchasePrice,
                            SalePrice: salePrice,
                            OldPurchasePrice: null,
                            OldSalePrice: null,
                            MinStock: settings.DefaultMinStock,
                            InitialStock: settings.DefaultInitialStock,
                            Status: "New",
                            ErrorMessage: null,
                            SheetName: ws.Name
                        ));
                        newCount++;
                    }
                }
            }

            return new ProductImportPreviewResult(
                TotalRows: items.Count,
                NewCount: newCount,
                ExistingCount: existingCount,
                UnchangedCount: unchangedCount,
                ErrorCount: errorCount,
                DetectedColumns: detectedDto,
                AvailableSheets: availableSheets,
                AvailableColumns: availableCols,
                Rows: items,
                SelectedSheet: string.IsNullOrWhiteSpace(options?.SheetName) ? null : options.SheetName,
                RawRows: rawPreviewRows
            );
        }
    }

    public async Task<ProductImportResult> CommitProductImportAsync(
        ProductImportCommitRequest request,
        string changedBy,
        CancellationToken cancellationToken = default)
    {
        if (request.Items == null || request.Items.Count == 0)
        {
            return new ProductImportResult(0, 0, 0, 0, null);
        }

        var settings = await GetImportSettingsAsync(cancellationToken);

        await using var tx = await db.BeginTransactionAsync(cancellationToken);

        // Mevcut ürünleri çek ve sözlüklere güvenli şekilde aktar
        var existingProducts = await db.Products.ToListAsync(cancellationToken);
        var productByCode = new Dictionary<string, Product>(StringComparer.OrdinalIgnoreCase);
        var productByBarcode = new Dictionary<string, Product>(StringComparer.OrdinalIgnoreCase);

        foreach (var p in existingProducts)
        {
            var c = CleanBarcode(p.Code, true);
            if (!string.IsNullOrEmpty(c)) productByCode[c] = p;

            var b = CleanBarcode(p.Barcode, true);
            if (!string.IsNullOrEmpty(b)) productByBarcode[b] = p;
        }

        // Çakışma davranışı 'fail' ise ve sistemde olan ürün varsa hata fırlat
        if (request.DuplicateAction.Equals("fail", StringComparison.OrdinalIgnoreCase))
        {
            foreach (var item in request.Items)
            {
                var barcodeToCheck = CleanBarcode(!string.IsNullOrWhiteSpace(item.Barcode) ? item.Barcode : item.Code, true);
                if (productByCode.ContainsKey(barcodeToCheck) || productByBarcode.ContainsKey(barcodeToCheck))
                {
                    throw new InvalidOperationException($"'{barcodeToCheck}' kodlu/barkodlu ürün sistemde zaten mevcut. İşlem iptal edildi.");
                }
            }
        }

        // Referans verileri hafızaya al
        var categories = await db.Categories.ToListAsync(cancellationToken);
        var categoryMap = new Dictionary<string, Category>(StringComparer.OrdinalIgnoreCase);
        foreach (var c in categories)
        {
            if (!string.IsNullOrWhiteSpace(c.Name)) categoryMap[c.Name.Trim()] = c;
        }

        var brands = await db.Brands.ToListAsync(cancellationToken);
        var brandMap = new Dictionary<string, Brand>(StringComparer.OrdinalIgnoreCase);
        foreach (var b in brands)
        {
            if (!string.IsNullOrWhiteSpace(b.Name)) brandMap[b.Name.Trim()] = b;
        }

        var units = await db.Units.ToListAsync(cancellationToken);
        var unitMap = new Dictionary<string, Unit>(StringComparer.OrdinalIgnoreCase);
        foreach (var u in units)
        {
            if (!string.IsNullOrWhiteSpace(u.Code)) unitMap[u.Code.Trim()] = u;
            if (!string.IsNullOrWhiteSpace(u.Name)) unitMap[u.Name.Trim()] = u;
        }

        // Varsayılan Kategori, Marka ve Birim güvencesi
        Category defaultCategory;
        var defCatName = settings.DefaultCategoryName ?? "Genel";
        if (!categoryMap.TryGetValue(defCatName, out defaultCategory!))
        {
            defaultCategory = new Category { Id = Guid.NewGuid(), Name = defCatName };
            db.Categories.Add(defaultCategory);
            categoryMap[defCatName] = defaultCategory;
        }

        Brand defaultBrand;
        var defBrandName = settings.DefaultBrandName ?? "Genel";
        if (!brandMap.TryGetValue(defBrandName, out defaultBrand!))
        {
            defaultBrand = new Brand { Id = Guid.NewGuid(), Name = defBrandName };
            db.Brands.Add(defaultBrand);
            brandMap[defBrandName] = defaultBrand;
        }

        Unit defaultUnit;
        var defUnitCode = settings.DefaultUnitName ?? "ADET";
        if (!unitMap.TryGetValue(defUnitCode, out defaultUnit!))
        {
            defaultUnit = new Unit { Id = Guid.NewGuid(), Code = defUnitCode.ToUpperInvariant(), Name = defUnitCode };
            db.Units.Add(defaultUnit);
            unitMap[defUnitCode] = defaultUnit;
        }

        var defaultWarehouse = await db.Warehouses.FirstOrDefaultAsync(cancellationToken);
        var batchId = Guid.NewGuid();

        int insertedCount = 0;
        int updatedCount = 0;
        int skippedCount = 0;

        foreach (var item in request.Items)
        {
            var rawBarcode = !string.IsNullOrWhiteSpace(item.Barcode) ? item.Barcode : item.Code;
            var barcode = CleanBarcode(rawBarcode, settings.SanitizeBarcode);
            var code = barcode; // Kullanıcı talebi: Ürün koduna barkod yazılır

            if (string.IsNullOrWhiteSpace(barcode))
                continue;

            Product? existing = null;
            var cleanKey = CleanBarcode(barcode, true);
            if (productByBarcode.TryGetValue(cleanKey, out var p1)) existing = p1;
            else if (productByCode.TryGetValue(cleanKey, out var p2)) existing = p2;

            if (existing != null)
            {
                if (request.DuplicateAction.Equals("skip", StringComparison.OrdinalIgnoreCase))
                {
                    skippedCount++;
                    continue;
                }

                // Update / Override
                existing.Name = item.Name.Trim();
                existing.Barcode = barcode;
                existing.Code = code;

                if (item.MinStock > 0)
                {
                    existing.MinStock = item.MinStock;
                }

                // Fiyat geçmişi kaydet
                bool saleChanged = existing.SalePrice != item.SalePrice;
                bool purchaseChanged = item.PurchasePrice > 0 && existing.PurchasePrice != item.PurchasePrice;

                if (saleChanged || purchaseChanged)
                {
                    db.PriceHistories.Add(new PriceHistory
                    {
                        Id = Guid.NewGuid(),
                        ProductId = existing.Id,
                        OldPurchasePrice = existing.PurchasePrice,
                        OldSalePrice = existing.SalePrice,
                        NewPurchasePrice = item.PurchasePrice > 0 ? item.PurchasePrice : existing.PurchasePrice,
                        NewSalePrice = item.SalePrice,
                        ChangedBy = $"{changedBy} (Toplu İçe Aktarma)",
                        BatchId = batchId,
                        IsReverted = false,
                        CreatedAt = DateTime.UtcNow
                    });
                }

                existing.SalePrice = item.SalePrice;
                if (item.PurchasePrice > 0)
                {
                    existing.PurchasePrice = item.PurchasePrice;
                }

                // Kullanıcı isterse mevcut ürünlerin marka/kategorisini de güncelle
                if (request.ApplyBrandCategoryToExisting)
                {
                    if (!string.IsNullOrWhiteSpace(item.CategoryName))
                    {
                        var exCatName = item.CategoryName.Trim();
                        if (!categoryMap.TryGetValue(exCatName, out var exCat))
                        {
                            exCat = new Category { Id = Guid.NewGuid(), Name = exCatName };
                            db.Categories.Add(exCat);
                            categoryMap[exCatName] = exCat;
                        }
                        existing.CategoryId = exCat.Id;
                    }

                    if (!string.IsNullOrWhiteSpace(item.BrandName))
                    {
                        var exBrName = item.BrandName.Trim();
                        if (!brandMap.TryGetValue(exBrName, out var exBr))
                        {
                            exBr = new Brand { Id = Guid.NewGuid(), Name = exBrName };
                            db.Brands.Add(exBr);
                            brandMap[exBrName] = exBr;
                        }
                        existing.BrandId = exBr.Id;
                    }
                }

                updatedCount++;
            }
            else
            {
                // Kategori Çözümleme
                var catName = !string.IsNullOrWhiteSpace(item.CategoryName) ? item.CategoryName.Trim() : defaultCategory.Name;
                if (!categoryMap.TryGetValue(catName, out var category))
                {
                    category = new Category { Id = Guid.NewGuid(), Name = catName };
                    db.Categories.Add(category);
                    categoryMap[catName] = category;
                }

                // Marka Çözümleme
                var brName = !string.IsNullOrWhiteSpace(item.BrandName) ? item.BrandName.Trim() : defaultBrand.Name;
                if (!brandMap.TryGetValue(brName, out var brand))
                {
                    brand = new Brand { Id = Guid.NewGuid(), Name = brName };
                    db.Brands.Add(brand);
                    brandMap[brName] = brand;
                }

                // Birim Çözümleme
                var unCode = !string.IsNullOrWhiteSpace(item.UnitCode) ? item.UnitCode.Trim() : defaultUnit.Code;
                if (!unitMap.TryGetValue(unCode, out var unit))
                {
                    unit = new Unit { Id = Guid.NewGuid(), Code = unCode.ToUpperInvariant(), Name = unCode };
                    db.Units.Add(unit);
                    unitMap[unCode] = unit;
                }

                var newProduct = new Product
                {
                    Id = Guid.NewGuid(),
                    Code = code,
                    Barcode = barcode,
                    Name = item.Name.Trim(),
                    BrandId = brand.Id,
                    CategoryId = category.Id,
                    UnitId = unit.Id,
                    PurchasePrice = item.PurchasePrice,
                    SalePrice = item.SalePrice,
                    MinStock = item.MinStock > 0 ? item.MinStock : settings.DefaultMinStock,
                    IsActive = true
                };

                db.Products.Add(newProduct);
                productByCode[cleanKey] = newProduct;
                productByBarcode[cleanKey] = newProduct;

                // Başlangıç stoğu hareketi ekle
                var initialStock = item.InitialStock > 0 ? item.InitialStock : settings.DefaultInitialStock;
                if (initialStock > 0 && defaultWarehouse != null)
                {
                    db.StockMovements.Add(new StockMovement
                    {
                        Id = Guid.NewGuid(),
                        ProductId = newProduct.Id,
                        WarehouseId = defaultWarehouse.Id,
                        Type = StockMovementType.StockCount,
                        Quantity = initialStock,
                        UnitPrice = item.PurchasePrice > 0 ? item.PurchasePrice : item.SalePrice,
                        ReferenceType = "Toplu Ürün Yükleme (Açılış)",
                        CreatedAt = DateTime.UtcNow
                    });
                }

                insertedCount++;
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return new ProductImportResult(insertedCount, updatedCount, skippedCount, request.Items.Count, batchId);
    }

    // ─── Akıllı Yardımcı Metodlar ─────────────────────────────────────────────

    private static void DetectColumnsFromSheet(
        IXLWorksheet ws,
        ref int barcodeCol,
        ref int nameCol,
        ref int salePriceCol,
        ref int purchasePriceCol)
    {
        var range = ws.RangeUsed();
        if (range == null) return;

        int firstR = range.FirstRow().RowNumber();
        int lastR = range.LastRow().RowNumber();
        int firstC = range.FirstColumn().ColumnNumber();
        int lastC = range.LastColumn().ColumnNumber();

        var trCulture = new System.Globalization.CultureInfo("tr-TR");

        // 1. Aşama: İlk 15 satırdan başlık satırını ara
        int bestHeaderRow = 0;
        int maxScore = 0;

        for (int r = firstR; r <= Math.Min(firstR + 14, lastR); r++)
        {
            var rowCellsUsed = ws.Row(r).CellsUsed().Count();
            if (rowCellsUsed < 2) continue; // Tek hücreli başlık/afiş satırları (ör. '2026-2027 EĞİTİM ÖĞRETİM...') tablo başlığı olamaz!

            int score = 0;
            for (int c = firstC; c <= lastC; c++)
            {
                var h = NormalizeTurkish(ws.Cell(r, c).GetString());
                if (string.IsNullOrEmpty(h)) continue;

                if (h.Contains("barkod") || h.Contains("barcode") || h.Contains("isbn") || (h.Contains("kod") && !h.Contains("ad"))) score += 2;
                else if (h.Contains("kitap") || h.Contains("urun") || h.Contains("ders")) score += 2;
                else if (h.Contains("fiyat") || h.Contains("kapak") || h.Contains("etiket") || h.Contains("satis") || (h.Contains("liste") && rowCellsUsed >= 2)) score += 2;
            }
            if (score > maxScore)
            {
                maxScore = score;
                bestHeaderRow = r;
            }
        }

        if (bestHeaderRow > 0 && maxScore >= 2)
        {
            // Çok satırlı başlıklarda (ör. Berkay'da üst satır Tarih, alt satır Etiket Fiyatı) bestHeaderRow ve bir sonraki satırı tara
            int maxHeaderScan = Math.Min(bestHeaderRow + 1, lastR);
            for (int rH = bestHeaderRow; rH <= maxHeaderScan; rH++)
            {
                for (int c = firstC; c <= lastC; c++)
                {
                    var h = NormalizeTurkish(ws.Cell(rH, c).GetString());
                    if (string.IsNullOrEmpty(h)) continue;

                    // Barkod / ISBN
                    if (barcodeCol == 0 && (h.Contains("barkod") || h.Contains("barcode") || h.Contains("isbn") || (h.Contains("kod") && !h.Contains("ad") && !h.Contains("ders"))))
                    {
                        barcodeCol = c;
                    }
                    // Alış / Bayi Fiyatı
                    else if (purchasePriceCol == 0 && (h.Contains("bayi") || (h.Contains("al") && h.Contains("fiyat")) || h.Contains("net fiyat") || h.Contains("isk. fiyat")))
                    {
                        purchasePriceCol = c;
                    }
                    // Satış / Liste / Kapak Fiyatı (Sayfa sayısı, iskonto, adet hariç!)
                    else if (salePriceCol == 0 && !h.Contains("sayfa") && !h.Contains("adet") && !h.Contains("isk") && (h.Contains("kapak") || h.Contains("liste") || h.Contains("etiket") || h.Contains("satis") || (h.Contains("fiyat") && !h.Contains("bayi"))))
                    {
                        salePriceCol = c;
                    }
                    // Ürün / Kitap Adı
                    else if (nameCol == 0 && !h.Contains("sayfa") && !h.Contains("kategori") && !h.Contains("marka") && !h.Contains("fiyat") && !h.Contains("birim") && !h.Contains("adet") && (h.Contains("kitap") || h.Contains("urun") || h.Contains("ders") || h.Contains("ad")))
                    {
                        nameCol = c;
                    }
                }
            }
        }



        // 2. Aşama: Veri içeriği tabanlı sezgisel tespit (Heuristic Fallback)
        if (barcodeCol == 0 || nameCol == 0 || salePriceCol == 0)
        {
            var digitCounts = new Dictionary<int, int>();
            var textLengthSums = new Dictionary<int, int>();
            var priceCounts = new Dictionary<int, int>();

            int startR = bestHeaderRow > 0 ? bestHeaderRow + 1 : firstR;
            int endR = Math.Min(startR + 30, lastR);

            for (int r = startR; r <= endR; r++)
            {
                for (int c = firstC; c <= lastC; c++)
                {
                    var headerText = bestHeaderRow > 0 ? NormalizeTurkish(ws.Cell(bestHeaderRow, c).GetString()) : "";
                    var cell = ws.Cell(r, c);
                    var str = cell.GetString().Trim();
                    var cleanDigits = Regex.Replace(str, @"[\s\-]", "");

                    // Barkod kontrolü: 10-13 haneli rakamlar veya 978/868 ile başlayanlar
                    if (cleanDigits.Length is >= 10 and <= 14 && cleanDigits.All(char.IsDigit))
                    {
                        digitCounts[c] = digitCounts.GetValueOrDefault(c) + 1;
                    }
                    else if (cell.DataType == XLDataType.Number && cell.Value.GetNumber() > 1e9 && cell.Value.GetNumber() < 1e14)
                    {
                        digitCounts[c] = digitCounts.GetValueOrDefault(c) + 1;
                    }

                    // Uzun metin kontrolü (ürün adı)
                    if (str.Length > 8 && !cleanDigits.All(char.IsDigit) && !headerText.Contains("sayfa"))
                    {
                        textLengthSums[c] = textLengthSums.GetValueOrDefault(c) + str.Length;
                    }

                    // Fiyat kontrolü: Sütunda 'sayfa', 'adet', 'isk', 'sira' başlığı/içeriği varsa kesinlikle fiyat sayma!
                    bool colHasSayfaKeyword = false;
                    for (int checkR = firstR; checkR <= Math.Min(firstR + 15, lastR); checkR++)
                    {
                        var cellText = NormalizeTurkish(ws.Cell(checkR, c).GetString());
                        if (cellText.Contains("sayfa") || cellText.Contains("adet") || cellText.Contains("isk") || cellText.Contains("sira"))
                        {
                            colHasSayfaKeyword = true;
                            break;
                        }
                    }

                    if (!colHasSayfaKeyword)
                    {
                        decimal p = ParseDecimalCell(cell);
                        if (p > 0 && p < 100000 && cleanDigits.Length < 10)
                        {
                            priceCounts[c] = priceCounts.GetValueOrDefault(c) + 1;
                        }
                    }
                }
            }

            if (barcodeCol == 0 && digitCounts.Any())
                barcodeCol = digitCounts.OrderByDescending(kv => kv.Value).First().Key;

            int currentBarcodeCol = barcodeCol;
            if (nameCol == 0 && textLengthSums.Any())
                nameCol = textLengthSums.Where(kv => kv.Key != currentBarcodeCol).OrderByDescending(kv => kv.Value).Select(kv => kv.Key).FirstOrDefault();

            int currentNameCol = nameCol;
            if (salePriceCol == 0 && priceCounts.Any())
                salePriceCol = priceCounts.Where(kv => kv.Key != currentBarcodeCol && kv.Key != currentNameCol).OrderByDescending(kv => kv.Value).Select(kv => kv.Key).FirstOrDefault();
        }
    }

    private static bool IsNonProductRow(
        IXLRow row,
        string cleanBarcode,
        string name,
        decimal salePrice,
        decimal purchasePrice)
    {
        // 1. Hem barkod hem ürün adı boşsa kesinlikle ürün değildir
        if (string.IsNullOrWhiteSpace(cleanBarcode) && string.IsNullOrWhiteSpace(name))
            return true;

        // 2. Eğer geçerli bir satış veya alış fiyatı yoksa (<= 0) VE ürün adı da yoksa:
        // Bu kesinlikle bir ürün değildir (kategori başlığı, ayraç vb.)
        if ((salePrice <= 0 && purchasePrice <= 0) && string.IsNullOrWhiteSpace(name))
            return true;

        // 3. Tek hücreli veya çok az hücreli satır kontrolü (kullanıcının belirttiği durum):
        // Satırdaki dolu hücre sayısı 2 veya daha az ise ve (fiyat yok veya ad yoksa) ürün olamaz
        int usedCellCount = row.CellsUsed().Count();
        if (usedCellCount <= 2 && (salePrice <= 0 || string.IsNullOrWhiteSpace(name)))
            return true;

        // 4. Paragraf / Dipnot / Açıklama metinleri (ör. "Belirtilen fiyatlar KDV'den istisnadır...")
        if (cleanBarcode.Length > 25)
            return true;

        // 5. Barkod alanına denk gelmiş ara başlıklar (ör. "1SINIFÜRÜNLERİMİZ", "TYTAYTÜRÜNLERİ", "SINAVLAR", "YENİ", "11SINIF")
        if (salePrice <= 0 && purchasePrice <= 0)
        {
            var cleanLower = cleanBarcode.ToLowerInvariant();
            if (cleanLower.Contains("sinif") ||
                cleanLower.Contains("urun") ||
                cleanLower.Contains("sinav") ||
                cleanLower.Contains("fiyat") ||
                cleanLower.Contains("kdv") ||
                cleanLower.Contains("iskonto") ||
                cleanLower.Contains("yeni") ||
                cleanLower.Contains("liste") ||
                cleanLower.Contains("toplam") ||
                cleanLower.Contains("ders"))
            {
                return true;
            }

            // Eğer harf içeriyorsa ve fiyat yoksa
            if (!cleanBarcode.All(char.IsDigit))
                return true;
        }

        // 6. Ürün adı alanına denk gelmiş ara başlıklar
        if (!string.IsNullOrWhiteSpace(name) && salePrice <= 0 && purchasePrice <= 0)
        {
            var nameLower = name.ToLowerInvariant();
            if (!cleanBarcode.All(char.IsDigit) || cleanBarcode.Length < 8)
            {
                if (nameLower.Contains("ürünlerimiz") ||
                    nameLower.Contains("fiyat listesi") ||
                    nameLower.Contains("kdv") ||
                    nameLower.Contains("açıklama") ||
                    nameLower.Contains("sinif") ||
                    nameLower.Contains("sinav"))
                {
                    return true;
                }
            }
        }

        return false;
    }

    private static string GetCellRawString(IXLCell cell)
    {
        if (cell.IsEmpty()) return string.Empty;
        if (cell.DataType == XLDataType.Number)
        {
            return cell.Value.GetNumber().ToString("F0", System.Globalization.CultureInfo.InvariantCulture);
        }
        return cell.GetString().Trim();
    }

    private static string NormalizeTurkish(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        return text.Trim()
            .Replace("İ", "i")
            .Replace("I", "i")
            .Replace("ı", "i")
            .Replace("Ç", "c")
            .Replace("ç", "c")
            .Replace("Ş", "s")
            .Replace("ş", "s")
            .Replace("Ğ", "g")
            .Replace("ğ", "g")
            .Replace("Ö", "o")
            .Replace("ö", "o")
            .Replace("Ü", "u")
            .Replace("ü", "u")
            .ToLowerInvariant();
    }


    private static string CleanBarcode(string? raw, bool sanitize)
    {
        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
        var trimmed = raw.Trim();
        if (!sanitize) return trimmed;
        // Tireleri, noktaları ve boşlukları temizle
        return Regex.Replace(trimmed, @"[\s\-\.]", "");
    }

    private static decimal ParseDecimalCell(IXLCell cell)
    {
        var val = ParseDecimalCellValue(cell);
        if (val > 0) return val;

        // Birleştirilmiş hücre kontrolü: Eğer hücre boşsa veya 0 ise ama birleştirilmiş bir alanın parçasıysa,
        // o birleşimin ilk hücresindeki (tepedeki) fiyatı otomatik devral
        if (cell.IsMerged())
        {
            var mr = cell.MergedRange();
            if (mr != null)
            {
                var firstCell = mr.FirstCell();
                if (firstCell.Address != cell.Address)
                {
                    return ParseDecimalCellValue(firstCell);
                }
            }
        }

        return 0;
    }

    private static decimal ParseDecimalCellValue(IXLCell cell)
    {
        if (cell.IsEmpty()) return 0;
        if (cell.DataType == XLDataType.Number)
        {
            return (decimal)cell.Value.GetNumber();
        }

        var raw = cell.GetString().Trim();
        if (string.IsNullOrEmpty(raw)) return 0;

        // Para birimi ve gereksiz karakterleri temizle
        raw = Regex.Replace(raw, @"[₺$€TLtl\s]", "");

        // 1.250,50 veya 1,250.50 gibi biçimleri ayrıştır
        if (raw.Contains(',') && raw.Contains('.'))
        {
            if (raw.LastIndexOf(',') > raw.LastIndexOf('.'))
            {
                // Türkçe: 1.250,50 -> 1250.50
                raw = raw.Replace(".", "").Replace(',', '.');
            }
            else
            {
                // İngilizce: 1,250.50 -> 1250.50
                raw = raw.Replace(",", "");
            }
        }
        else if (raw.Contains(','))
        {
            // 450,50 -> 450.50
            raw = raw.Replace(',', '.');
        }

        if (decimal.TryParse(raw, System.Globalization.NumberStyles.Any,
                             System.Globalization.CultureInfo.InvariantCulture, out var parsed))
        {
            return parsed;
        }

        return 0;
    }
}


