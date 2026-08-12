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
        string format,
        string? search,
        Guid? brandId,
        Guid? categoryId,
        bool? isActive,
        CancellationToken cancellationToken = default);
    Task<BulkPriceUpdateResult> BulkUpdatePricesAsync(BulkPriceUpdateRequest request, string changedBy, CancellationToken cancellationToken = default);
    Task<int> RevertBulkPriceUpdateAsync(Guid batchId, string revertedBy, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PriceHistoryDto>> GetRecentPriceHistoryAsync(int limit = 20, CancellationToken cancellationToken = default);
    Task<ImportPriceResult> ImportPricesFromCsvAsync(Stream csvStream, string changedBy, CancellationToken cancellationToken = default);
}

public class ProductService(IErpDbContext db, IReportExporterFactory exporterFactory) : IProductService
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
        string format,
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

        query = query.OrderBy(x => x.Name);

        var list = await ProductQuery(query).ToListAsync(cancellationToken);
        var exporter = exporterFactory.GetExporter(format);

        var headers = new[]
        {
            "Ürün Kodu", "Barkod", "Ürün Adı", "Marka", "Kategori",
            "Birim", "Alış Fiyatı", "Satış Fiyatı", "Min. Stok", "Durum"
        };

        var rows = list.Select(item => new[]
        {
            item.Code,
            // Barkod: Excel'in sayıya çevirip bilimsel gösterime dönüştürmemesi için ="..." formatı
            string.IsNullOrWhiteSpace(item.Barcode) ? "" : "=\"" + item.Barcode + "\"",
            item.Name,
            item.BrandName,
            item.CategoryName,
            item.UnitName,
            // InvariantCulture: ondalık ayırıcı nokta (62.50), CSV'de virgülle karışmasın
            item.PurchasePrice.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture),
            item.SalePrice.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture),
            item.MinStock.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture),
            item.IsActive ? "Aktif" : "Pasif"
        });

        var content = exporter.Export(headers, rows);
        var fileName = $"urunler_{DateTime.UtcNow:yyyyMMdd_HHmmss}{exporter.FileExtension}";

        return new ExportResult(content, exporter.ContentType, fileName);
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

    public async Task<ImportPriceResult> ImportPricesFromCsvAsync(
        Stream csvStream,
        string changedBy,
        CancellationToken cancellationToken = default)
    {
        using var reader = new StreamReader(csvStream, System.Text.Encoding.UTF8);
        var errors = new List<ImportPriceErrorRow>();
        var updateItems = new List<BulkPriceUpdateItem>();

        // ── 1. Header satırını oku ve kolon indekslerini bul ──────────────────
        var headerLine = await reader.ReadLineAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(headerLine))
            return new ImportPriceResult(0, 0, 1, null,
                [new ImportPriceErrorRow(0, "", "CSV dosyası boş veya geçersiz.")]
            );

        var headers = ParseCsvLine(headerLine);
        int codeIdx      = Array.FindIndex(headers, h => h.Equals("Ürün Kodu",    StringComparison.OrdinalIgnoreCase));
        int purchaseIdx  = Array.FindIndex(headers, h => h.Equals("Alış Fiyatı",  StringComparison.OrdinalIgnoreCase));
        int saleIdx      = Array.FindIndex(headers, h => h.Equals("Satış Fiyatı", StringComparison.OrdinalIgnoreCase));

        if (codeIdx < 0 || (purchaseIdx < 0 && saleIdx < 0))
            return new ImportPriceResult(0, 0, 1, null,
                [new ImportPriceErrorRow(1, headerLine, "Gerekli kolon bulunamadı: 'Ürün Kodu' ve 'Alış Fiyatı' / 'Satış Fiyatı'.")]
            );

        // ── 2. Veri satırlarını oku ──────────────────────────────────────────
        var csvRows = new List<(int Row, string Code, decimal? Purchase, decimal? Sale)>();
        int rowNumber = 1;

        string? line;
        while ((line = await reader.ReadLineAsync(cancellationToken)) != null)
        {
            rowNumber++;
            if (string.IsNullOrWhiteSpace(line)) continue;

            var cols = ParseCsvLine(line);
            if (cols.Length <= codeIdx)
            {
                errors.Add(new ImportPriceErrorRow(rowNumber, line, "Satır beklenen kolon sayısından kısa."));
                continue;
            }

            var code = cols[codeIdx].Trim();
            if (string.IsNullOrEmpty(code))
            {
                errors.Add(new ImportPriceErrorRow(rowNumber, line, "Ürün Kodu boş."));
                continue;
            }

            decimal? purchase = null;
            decimal? sale     = null;

            if (purchaseIdx >= 0 && purchaseIdx < cols.Length)
            {
                var raw = cols[purchaseIdx].Trim().Replace(",", ".");
                if (decimal.TryParse(raw, System.Globalization.NumberStyles.Any,
                                     System.Globalization.CultureInfo.InvariantCulture, out var p))
                    purchase = p;
                else if (!string.IsNullOrWhiteSpace(raw))
                    errors.Add(new ImportPriceErrorRow(rowNumber, line, $"Alış fiyatı okunamadı: '{raw}'"));
            }

            if (saleIdx >= 0 && saleIdx < cols.Length)
            {
                var raw = cols[saleIdx].Trim().Replace(",", ".");
                if (decimal.TryParse(raw, System.Globalization.NumberStyles.Any,
                                     System.Globalization.CultureInfo.InvariantCulture, out var s))
                    sale = s;
                else if (!string.IsNullOrWhiteSpace(raw))
                    errors.Add(new ImportPriceErrorRow(rowNumber, line, $"Satış fiyatı okunamadı: '{raw}'"));
            }

            if (purchase.HasValue || sale.HasValue)
                csvRows.Add((rowNumber, code, purchase, sale));
        }

        if (csvRows.Count == 0)
            return new ImportPriceResult(0, 0, errors.Count, null, errors);

        // ── 3. Ürünleri DB'den tek sorguda çek ───────────────────────────────
        var codes = csvRows.Select(r => r.Code).Distinct().ToList();
        var dbProducts = await db.Products
            .Where(x => codes.Contains(x.Code))
            .ToListAsync(cancellationToken);

        var productByCode = dbProducts.ToDictionary(p => p.Code, StringComparer.OrdinalIgnoreCase);

        // ── 4. Sadece değişen fiyatları güncelle ─────────────────────────────
        var batchId   = Guid.NewGuid();
        int updated   = 0;
        int skipped   = 0;
        bool anyChange = false;

        foreach (var (row, code, purchase, sale) in csvRows)
        {
            if (!productByCode.TryGetValue(code, out var product))
            {
                errors.Add(new ImportPriceErrorRow(row, code, $"Ürün bulunamadı: '{code}'"));
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
                errors.Add(new ImportPriceErrorRow(row, code, "Alış fiyatı negatif olamaz."));
                continue;
            }
            if (newSale.HasValue && newSale.Value < 0)
            {
                errors.Add(new ImportPriceErrorRow(row, code, "Satış fiyatı negatif olamaz."));
                continue;
            }

            db.PriceHistories.Add(new ERP.Domain.Entities.PriceHistory
            {
                Id                = Guid.NewGuid(),
                ProductId         = product.Id,
                OldPurchasePrice  = product.PurchasePrice,
                OldSalePrice      = product.SalePrice,
                NewPurchasePrice  = newPurchase ?? product.PurchasePrice,
                NewSalePrice      = newSale     ?? product.SalePrice,
                ChangedBy         = changedBy,
                BatchId           = batchId,
                CreatedAt         = DateTime.UtcNow
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

    // RFC 4180 uyumlu basit CSV satır parser'ı
    private static string[] ParseCsvLine(string line)
    {
        var result = new List<string>();
        var current = new System.Text.StringBuilder();
        bool inQuotes = false;

        for (int i = 0; i < line.Length; i++)
        {
            char c = line[i];
            if (c == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    current.Append('"'); i++; // escaped quote
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (c == ',' && !inQuotes)
            {
                result.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }
        result.Add(current.ToString());
        return [.. result];
    }
}
