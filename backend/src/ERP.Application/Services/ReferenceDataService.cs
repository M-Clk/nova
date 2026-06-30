using ERP.Application.Abstractions;
using ERP.Application.Dto;
using ERP.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ERP.Application.Services;

public interface IReferenceDataService
{
    Task<ReferenceDataDto> GetAsync(CancellationToken cancellationToken = default);
    Task<LookupDto> CreateBrandAsync(CreateLookupRequest request, CancellationToken cancellationToken = default);
    Task<bool> UpdateBrandAsync(Guid id, UpdateLookupRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteBrandAsync(Guid id, CancellationToken cancellationToken = default);
    Task<LookupDto> CreateCategoryAsync(CreateLookupRequest request, CancellationToken cancellationToken = default);
    Task<bool> UpdateCategoryAsync(Guid id, UpdateLookupRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteCategoryAsync(Guid id, CancellationToken cancellationToken = default);
    Task<LookupDto> CreateUnitAsync(CreateLookupRequest request, CancellationToken cancellationToken = default);
    Task<bool> UpdateUnitAsync(Guid id, UpdateLookupRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteUnitAsync(Guid id, CancellationToken cancellationToken = default);
    Task<LookupDto> CreateWarehouseAsync(CreateLookupRequest request, CancellationToken cancellationToken = default);
}

public class ReferenceDataService(IErpDbContext db) : IReferenceDataService
{
    public async Task<ReferenceDataDto> GetAsync(CancellationToken cancellationToken = default)
    {
        var brands = await db.Brands.AsNoTracking().OrderBy(x => x.Name)
            .Select(x => new LookupDto(x.Id, string.Empty, x.Name)).ToListAsync(cancellationToken);
        var categories = await db.Categories.AsNoTracking().OrderBy(x => x.Name)
            .Select(x => new LookupDto(x.Id, string.Empty, x.Name)).ToListAsync(cancellationToken);
        var units = await db.Units.AsNoTracking().OrderBy(x => x.Name)
            .Select(x => new LookupDto(x.Id, x.Code, x.Name)).ToListAsync(cancellationToken);
        var warehouses = await db.Warehouses.AsNoTracking().OrderBy(x => x.Name)
            .Select(x => new LookupDto(x.Id, string.Empty, x.Name)).ToListAsync(cancellationToken);

        return new ReferenceDataDto(brands, categories, units, warehouses);
    }

    public async Task<LookupDto> CreateBrandAsync(CreateLookupRequest request, CancellationToken cancellationToken = default)
    {
        var entity = new Brand { Id = Guid.NewGuid(), Name = request.Name.Trim() };
        db.Brands.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        return new LookupDto(entity.Id, string.Empty, entity.Name);
    }

    public async Task<bool> UpdateBrandAsync(Guid id, UpdateLookupRequest request, CancellationToken cancellationToken = default)
    {
        var brand = await db.Brands.FindAsync([id], cancellationToken);
        if (brand is null) return false;
        brand.Name = request.Name.Trim();
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> DeleteBrandAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var brand = await db.Brands.FindAsync([id], cancellationToken);
        if (brand is null) return false;

        var hasProducts = await db.Products.AnyAsync(x => x.BrandId == id, cancellationToken);
        if (hasProducts)
        {
            throw new InvalidOperationException("Bu markaya atanmış aktif ürünler bulunduğundan marka silinemez.");
        }

        db.Brands.Remove(brand);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<LookupDto> CreateCategoryAsync(CreateLookupRequest request, CancellationToken cancellationToken = default)
    {
        var entity = new Category { Id = Guid.NewGuid(), Name = request.Name.Trim(), ParentId = request.ParentId };
        db.Categories.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        return new LookupDto(entity.Id, string.Empty, entity.Name);
    }

    public async Task<bool> UpdateCategoryAsync(Guid id, UpdateLookupRequest request, CancellationToken cancellationToken = default)
    {
        var category = await db.Categories.FindAsync([id], cancellationToken);
        if (category is null) return false;
        category.Name = request.Name.Trim();
        category.ParentId = request.ParentId;
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> DeleteCategoryAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var category = await db.Categories.FindAsync([id], cancellationToken);
        if (category is null) return false;

        var hasProducts = await db.Products.AnyAsync(x => x.CategoryId == id, cancellationToken);
        if (hasProducts)
        {
            throw new InvalidOperationException("Bu kategoriye atanmış aktif ürünler olduğundan kategori silinemez.");
        }

        var hasSubcategories = await db.Categories.AnyAsync(x => x.ParentId == id, cancellationToken);
        if (hasSubcategories)
        {
            throw new InvalidOperationException("Bu kategoriye bağlı alt kategoriler bulunduğundan kategori silinemez.");
        }

        db.Categories.Remove(category);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<LookupDto> CreateUnitAsync(CreateLookupRequest request, CancellationToken cancellationToken = default)
    {
        var entity = new Unit { Id = Guid.NewGuid(), Code = (request.Code ?? request.Name).Trim(), Name = request.Name.Trim() };
        db.Units.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        return new LookupDto(entity.Id, entity.Code, entity.Name);
    }

    public async Task<bool> UpdateUnitAsync(Guid id, UpdateLookupRequest request, CancellationToken cancellationToken = default)
    {
        var unit = await db.Units.FindAsync([id], cancellationToken);
        if (unit is null) return false;
        unit.Code = (request.Code ?? request.Name).Trim();
        unit.Name = request.Name.Trim();
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> DeleteUnitAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var unit = await db.Units.FindAsync([id], cancellationToken);
        if (unit is null) return false;

        var hasProducts = await db.Products.AnyAsync(x => x.UnitId == id, cancellationToken);
        if (hasProducts)
        {
            throw new InvalidOperationException("Bu ölçü birimine atanmış aktif ürünler bulunduğundan ölçü birimi silinemez.");
        }

        db.Units.Remove(unit);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<LookupDto> CreateWarehouseAsync(CreateLookupRequest request, CancellationToken cancellationToken = default)
    {
        var entity = new Warehouse { Id = Guid.NewGuid(), Name = request.Name.Trim() };
        db.Warehouses.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        return new LookupDto(entity.Id, string.Empty, entity.Name);
    }
}
