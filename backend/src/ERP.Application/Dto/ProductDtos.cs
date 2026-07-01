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

