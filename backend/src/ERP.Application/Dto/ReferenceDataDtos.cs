namespace ERP.Application.Dto;

public record LookupDto(Guid Id, string Code, string Name);

public record ReferenceDataDto(
    IReadOnlyList<LookupDto> Brands,
    IReadOnlyList<LookupDto> Categories,
    IReadOnlyList<LookupDto> Units,
    IReadOnlyList<LookupDto> Warehouses);

public record CreateLookupRequest(string Name, string? Code = null, Guid? ParentId = null);
public record UpdateLookupRequest(string Name, string? Code = null, Guid? ParentId = null);

// ─── Warehouse CRUD ───────────────────────────────────────────────────────────

public record WarehouseDto(Guid Id, string Name);
public record CreateWarehouseRequest(string Name);
public record UpdateWarehouseRequest(string Name);
