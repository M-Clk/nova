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

    // ─── Bulk Product Import ──────────────────────────────────────────────────
    Task<byte[]> GenerateImportTemplateAsync(CancellationToken cancellationToken = default);
    Task<ProductImportPreviewResult> PreviewProductImportAsync(Stream xlsxStream, CancellationToken cancellationToken = default);
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

    public async Task<ProductImportPreviewResult> PreviewProductImportAsync(
        Stream xlsxStream,
        CancellationToken cancellationToken = default)
    {
        XLWorkbook workbook;
        try
        {
            workbook = new XLWorkbook(xlsxStream);
        }
        catch (Exception ex)
        {
            return new ProductImportPreviewResult(0, 0, 0, 1,
            [
                new ProductImportPreviewItem(0, "", "", "", "", null, "", null, "", 0, 0, 0, 0, "Error", $"Excel dosyası okunamadı: {ex.Message}")
            ]);
        }

        using (workbook)
        {
            var ws = workbook.Worksheets.FirstOrDefault();
            if (ws is null)
            {
                return new ProductImportPreviewResult(0, 0, 0, 1,
                [
                    new ProductImportPreviewItem(0, "", "", "", "", null, "", null, "", 0, 0, 0, 0, "Error", "Excel dosyasında sayfa bulunamadı.")
                ]);
            }

            // Kolon indekslerini bul
            var headerRow = ws.Row(1);
            int lastHeaderCol = ws.LastColumnUsed()?.ColumnNumber() ?? 0;

            int codeCol = 0;
            int barcodeCol = 0;
            int nameCol = 0;
            int categoryCol = 0;
            int brandCol = 0;
            int unitCol = 0;
            int purchasePriceCol = 0;
            int salePriceCol = 0;
            int minStockCol = 0;
            int initialStockCol = 0;

            for (int col = 1; col <= lastHeaderCol; col++)
            {
                var h = headerRow.Cell(col).GetString().Trim().ToLowerInvariant();
                if (h.Contains("kod") && !h.Contains("bar")) codeCol = col;
                else if (h.Contains("bar")) barcodeCol = col;
                else if (h.Contains("ad")) nameCol = col;
                else if (h.Contains("kategori")) categoryCol = col;
                else if (h.Contains("marka")) brandCol = col;
                else if (h.Contains("birim")) unitCol = col;
                else if (h.Contains("al") && h.Contains("fiyat")) purchasePriceCol = col;
                else if (h.Contains("sat") && h.Contains("fiyat")) salePriceCol = col;
                else if (h.Contains("kritik") || h.Contains("min")) minStockCol = col;
                else if (h.Contains("stok") || h.Contains("miktar") || h.Contains("devir")) initialStockCol = col;
            }

            if (codeCol == 0 || nameCol == 0)
            {
                return new ProductImportPreviewResult(0, 0, 0, 1,
                [
                    new ProductImportPreviewItem(1, "", "", "", "", null, "", null, "", 0, 0, 0, 0, "Error", "Gerekli kolonlar bulunamadı! 'Ürün Kodu' ve 'Ürün Adı' başlıkları zorunludur.")
                ]);
            }

            // Sistemdeki mevcut ürünleri çek
            var existingProducts = await db.Products
                .AsNoTracking()
                .Select(x => new { x.Id, x.Code, x.Barcode, x.Name })
                .ToListAsync(cancellationToken);

            var existingCodes = new HashSet<string>(
                existingProducts.Select(x => x.Code.Trim()),
                StringComparer.OrdinalIgnoreCase);

            var existingBarcodes = new HashSet<string>(
                existingProducts.Where(x => !string.IsNullOrWhiteSpace(x.Barcode)).Select(x => x.Barcode!.Trim()),
                StringComparer.OrdinalIgnoreCase);

            var seenCodesInFile = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var items = new List<ProductImportPreviewItem>();
            int lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;

            int newCount = 0;
            int existingCount = 0;
            int errorCount = 0;

            for (int r = 2; r <= lastRow; r++)
            {
                var row = ws.Row(r);
                if (row.IsEmpty()) continue;

                var code = row.Cell(codeCol).GetString().Trim();
                var name = row.Cell(nameCol).GetString().Trim();
                var barcode = barcodeCol > 0 ? row.Cell(barcodeCol).GetString().Trim() : "";

                // Kullanıcı barkod girmemişse, perakende akışına uygun olarak ürün kodunu barkod olarak varsayalım
                if (string.IsNullOrWhiteSpace(barcode))
                {
                    barcode = code;
                }

                var category = categoryCol > 0 ? row.Cell(categoryCol).GetString().Trim() : "";
                var brand = brandCol > 0 ? row.Cell(brandCol).GetString().Trim() : "";
                var unit = unitCol > 0 ? row.Cell(unitCol).GetString().Trim() : "";
                if (string.IsNullOrWhiteSpace(unit)) unit = "ADET";

                decimal purchasePrice = purchasePriceCol > 0 ? ParseDecimalCell(row.Cell(purchasePriceCol)) : 0;
                decimal salePrice = salePriceCol > 0 ? ParseDecimalCell(row.Cell(salePriceCol)) : 0;
                decimal minStock = minStockCol > 0 ? ParseDecimalCell(row.Cell(minStockCol)) : 0;
                decimal initialStock = initialStockCol > 0 ? ParseDecimalCell(row.Cell(initialStockCol)) : 0;

                string status;
                string? errorMessage = null;

                if (string.IsNullOrWhiteSpace(code))
                {
                    status = "Error";
                    errorMessage = "Ürün kodu zorunludur.";
                    errorCount++;
                }
                else if (string.IsNullOrWhiteSpace(name))
                {
                    status = "Error";
                    errorMessage = "Ürün adı zorunludur.";
                    errorCount++;
                }
                else if (seenCodesInFile.Contains(code))
                {
                    status = "Error";
                    errorMessage = $"Bu ürün kodu ('{code}') dosya içinde birden fazla kez geçiyor.";
                    errorCount++;
                }
                else if (purchasePrice < 0 || salePrice < 0 || minStock < 0 || initialStock < 0)
                {
                    status = "Error";
                    errorMessage = "Fiyat ve stok değerleri negatif olamaz.";
                    errorCount++;
                }
                else
                {
                    seenCodesInFile.Add(code);

                    bool isExisting = existingCodes.Contains(code) || (!string.IsNullOrWhiteSpace(barcode) && existingBarcodes.Contains(barcode));
                    if (isExisting)
                    {
                        status = "Existing";
                        errorMessage = "Bu ürün koduna/barkoduna sahip ürün sistemde zaten kayıtlı.";
                        existingCount++;
                    }
                    else
                    {
                        status = "New";
                        newCount++;
                    }
                }

                // Akıllı kategori ve marka önerisi
                string? suggestedCategory = null;
                string? suggestedBrand = null;

                if (string.IsNullOrWhiteSpace(category) && !string.IsNullOrWhiteSpace(name))
                {
                    var catSuggestion = await categorization.SuggestAsync(name, cancellationToken);
                    if (catSuggestion != null) suggestedCategory = catSuggestion.SuggestedCategoryName;
                }

                if (string.IsNullOrWhiteSpace(brand) && !string.IsNullOrWhiteSpace(name))
                {
                    var brandSuggestion = await branding.SuggestAsync(name, cancellationToken);
                    if (brandSuggestion != null) suggestedBrand = brandSuggestion.SuggestedBrandName;
                }

                items.Add(new ProductImportPreviewItem(
                    RowNumber: r,
                    Code: code,
                    Barcode: barcode,
                    Name: name,
                    CategoryName: category,
                    SuggestedCategoryName: suggestedCategory,
                    BrandName: brand,
                    SuggestedBrandName: suggestedBrand,
                    UnitCode: unit,
                    PurchasePrice: purchasePrice,
                    SalePrice: salePrice,
                    MinStock: minStock,
                    InitialStock: initialStock,
                    Status: status,
                    ErrorMessage: errorMessage
                ));
            }

            return new ProductImportPreviewResult(items.Count, newCount, existingCount, errorCount, items);
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

        await using var tx = await db.BeginTransactionAsync(cancellationToken);

        // Mevcut ürünleri çek ve sözlüklere güvenli şekilde aktar (DB'de çift barkod/kod olsa bile patlamaz)
        var existingProducts = await db.Products.ToListAsync(cancellationToken);
        var productByCode = new Dictionary<string, Product>(StringComparer.OrdinalIgnoreCase);
        var productByBarcode = new Dictionary<string, Product>(StringComparer.OrdinalIgnoreCase);

        foreach (var p in existingProducts)
        {
            var c = p.Code?.Trim();
            if (!string.IsNullOrEmpty(c))
            {
                productByCode[c] = p;
            }

            var b = p.Barcode?.Trim();
            if (!string.IsNullOrEmpty(b))
            {
                productByBarcode[b] = p;
            }
        }

        // Çakışma davranışı 'fail' ise ve sistemde olan ürün varsa hata fırlat
        if (request.DuplicateAction.Equals("fail", StringComparison.OrdinalIgnoreCase))
        {
            foreach (var item in request.Items)
            {
                var barcodeToCheck = !string.IsNullOrWhiteSpace(item.Barcode) ? item.Barcode.Trim() : item.Code.Trim();
                if (productByCode.ContainsKey(item.Code.Trim()) || productByBarcode.ContainsKey(barcodeToCheck))
                {
                    throw new InvalidOperationException($"'{item.Code}' kodlu ürün sistemde zaten mevcut. İşlem iptal edildi.");
                }
            }
        }

        // Referans verileri hafızaya al (güvenli sözlük)
        var categories = await db.Categories.ToListAsync(cancellationToken);
        var categoryMap = new Dictionary<string, Category>(StringComparer.OrdinalIgnoreCase);
        foreach (var c in categories)
        {
            if (!string.IsNullOrWhiteSpace(c.Name))
                categoryMap[c.Name.Trim()] = c;
        }

        var brands = await db.Brands.ToListAsync(cancellationToken);
        var brandMap = new Dictionary<string, Brand>(StringComparer.OrdinalIgnoreCase);
        foreach (var b in brands)
        {
            if (!string.IsNullOrWhiteSpace(b.Name))
                brandMap[b.Name.Trim()] = b;
        }

        var units = await db.Units.ToListAsync(cancellationToken);
        var unitMap = new Dictionary<string, Unit>(StringComparer.OrdinalIgnoreCase);
        foreach (var u in units)
        {
            if (!string.IsNullOrWhiteSpace(u.Code))
                unitMap[u.Code.Trim()] = u;
            if (!string.IsNullOrWhiteSpace(u.Name))
                unitMap[u.Name.Trim()] = u;
        }

        // Varsayılan Kategori, Marka ve Birim güvencesi
        Category defaultCategory;
        if (!categoryMap.TryGetValue("Genel", out defaultCategory!))
        {
            defaultCategory = new Category { Id = Guid.NewGuid(), Name = "Genel" };
            db.Categories.Add(defaultCategory);
            categoryMap["Genel"] = defaultCategory;
        }

        Brand defaultBrand;
        if (!brandMap.TryGetValue("Genel", out defaultBrand!))
        {
            defaultBrand = new Brand { Id = Guid.NewGuid(), Name = "Genel" };
            db.Brands.Add(defaultBrand);
            brandMap["Genel"] = defaultBrand;
        }

        Unit defaultUnit;
        if (!unitMap.TryGetValue("ADET", out defaultUnit!))
        {
            defaultUnit = new Unit { Id = Guid.NewGuid(), Code = "ADET", Name = "Adet" };
            db.Units.Add(defaultUnit);
            unitMap["ADET"] = defaultUnit;
        }

        var defaultWarehouse = await db.Warehouses.FirstOrDefaultAsync(cancellationToken);
        var batchId = Guid.NewGuid();

        int insertedCount = 0;
        int updatedCount = 0;
        int skippedCount = 0;

        foreach (var item in request.Items)
        {
            var code = item.Code.Trim();
            var barcode = !string.IsNullOrWhiteSpace(item.Barcode) ? item.Barcode.Trim() : code;

            Product? existing = null;
            if (productByCode.TryGetValue(code, out var p1)) existing = p1;
            else if (productByBarcode.TryGetValue(barcode, out var p2)) existing = p2;

            if (existing != null)
            {
                if (request.DuplicateAction.Equals("skip", StringComparison.OrdinalIgnoreCase))
                {
                    skippedCount++;
                    continue;
                }

                // Update / Override
                existing.Name = item.Name.Trim();
                if (!string.IsNullOrWhiteSpace(barcode)) existing.Barcode = barcode;
                existing.MinStock = item.MinStock;

                // Fiyat geçmişi kaydet
                if (existing.PurchasePrice != item.PurchasePrice || existing.SalePrice != item.SalePrice)
                {
                    db.PriceHistories.Add(new PriceHistory
                    {
                        Id = Guid.NewGuid(),
                        ProductId = existing.Id,
                        OldPurchasePrice = existing.PurchasePrice,
                        OldSalePrice = existing.SalePrice,
                        NewPurchasePrice = item.PurchasePrice,
                        NewSalePrice = item.SalePrice,
                        ChangedBy = $"{changedBy} (Toplu İçe Aktarma)",
                        BatchId = batchId,
                        IsReverted = false,
                        CreatedAt = DateTime.UtcNow
                    });
                }

                existing.PurchasePrice = item.PurchasePrice;
                existing.SalePrice = item.SalePrice;

                updatedCount++;
            }
            else
            {
                // Kategori Çözümleme
                var catName = !string.IsNullOrWhiteSpace(item.CategoryName) ? item.CategoryName.Trim() : "Genel";
                if (!categoryMap.TryGetValue(catName, out var category))
                {
                    category = new Category { Id = Guid.NewGuid(), Name = catName };
                    db.Categories.Add(category);
                    categoryMap[catName] = category;
                }

                // Marka Çözümleme
                var brName = !string.IsNullOrWhiteSpace(item.BrandName) ? item.BrandName.Trim() : "Genel";
                if (!brandMap.TryGetValue(brName, out var brand))
                {
                    brand = new Brand { Id = Guid.NewGuid(), Name = brName };
                    db.Brands.Add(brand);
                    brandMap[brName] = brand;
                }

                // Birim Çözümleme
                var unCode = !string.IsNullOrWhiteSpace(item.UnitCode) ? item.UnitCode.Trim() : "ADET";
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
                    MinStock = item.MinStock,
                    IsActive = true
                };

                db.Products.Add(newProduct);
                productByCode[code] = newProduct;
                productByBarcode[barcode] = newProduct;

                // Başlangıç stoğu hareketi ekle
                if (item.InitialStock > 0 && defaultWarehouse != null)
                {
                    db.StockMovements.Add(new StockMovement
                    {
                        Id = Guid.NewGuid(),
                        ProductId = newProduct.Id,
                        WarehouseId = defaultWarehouse.Id,
                        Type = StockMovementType.StockCount,
                        Quantity = item.InitialStock,
                        UnitPrice = item.PurchasePrice,
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

    private static decimal ParseDecimalCell(IXLCell cell)
    {
        if (cell.IsEmpty()) return 0;
        if (cell.TryGetValue(out double dVal)) return (decimal)dVal;

        var raw = cell.GetString().Trim().Replace(",", ".");
        if (decimal.TryParse(raw, System.Globalization.NumberStyles.Any,
                             System.Globalization.CultureInfo.InvariantCulture, out var parsed))
        {
            return parsed;
        }

        return 0;
    }
}


