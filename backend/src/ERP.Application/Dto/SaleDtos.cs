namespace ERP.Application.Dto;

public record SaleDto(
    Guid Id,
    string SaleNo,
    Guid? CustomerId,
    string? CustomerName,
    decimal TotalAmount,
    decimal DiscountAmount,
    decimal NetAmount,
    DateTime CreatedAt,
    IReadOnlyList<SaleItemDto> Items);

public record SaleItemDto(
    Guid Id,
    Guid ProductId,
    string ProductCode,
    string ProductName,
    decimal Quantity,
    decimal UnitPrice,
    decimal DiscountAmount,
    decimal LineTotal);

public record CreateSaleRequest(
    Guid? CustomerId,
    Guid? WarehouseId,
    IReadOnlyList<CreateSaleItemRequest> Items);

public record CreateSaleItemRequest(
    Guid ProductId,
    decimal Quantity,
    decimal? UnitPrice,
    decimal DiscountAmount);
