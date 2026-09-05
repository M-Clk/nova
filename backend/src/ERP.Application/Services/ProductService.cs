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
}

