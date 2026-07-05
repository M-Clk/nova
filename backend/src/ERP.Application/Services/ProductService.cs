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
            item.Barcode,
            item.Name,
            item.BrandName,
            item.CategoryName,
            item.UnitName,
            item.PurchasePrice.ToString("N2"),
            item.SalePrice.ToString("N2"),
            item.MinStock.ToString("N2"),
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
}
