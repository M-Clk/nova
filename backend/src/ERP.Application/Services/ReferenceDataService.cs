using ERP.Application.Abstractions;
using ERP.Application.Dto;
using ERP.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ERP.Application.Services;

public interface IReferenceDataService
{
    Task<ReferenceDataDto> GetAsync(CancellationToken cancellationToken = default);
    Task<LookupDto> CreateBrandAsync(CreateLookupRequest request, CancellationToken cancellationToken = default);
    Task<LookupDto> CreateCategoryAsync(CreateLookupRequest request, CancellationToken cancellationToken = default);
    Task<LookupDto> CreateUnitAsync(CreateLookupRequest request, CancellationToken cancellationToken = default);
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

    public async Task<LookupDto> CreateCategoryAsync(CreateLookupRequest request, CancellationToken cancellationToken = default)
    {
        var entity = new Category { Id = Guid.NewGuid(), Name = request.Name.Trim(), ParentId = request.ParentId };
        db.Categories.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        return new LookupDto(entity.Id, string.Empty, entity.Name);
    }

    public async Task<LookupDto> CreateUnitAsync(CreateLookupRequest request, CancellationToken cancellationToken = default)
    {
        var entity = new Unit { Id = Guid.NewGuid(), Code = (request.Code ?? request.Name).Trim(), Name = request.Name.Trim() };
        db.Units.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        return new LookupDto(entity.Id, entity.Code, entity.Name);
    }

    public async Task<LookupDto> CreateWarehouseAsync(CreateLookupRequest request, CancellationToken cancellationToken = default)
    {
        var entity = new Warehouse { Id = Guid.NewGuid(), Name = request.Name.Trim() };
        db.Warehouses.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        return new LookupDto(entity.Id, string.Empty, entity.Name);
    }
}
