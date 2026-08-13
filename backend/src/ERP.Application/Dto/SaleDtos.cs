namespace ERP.Application.Dto;

public record SaleDto(
    Guid Id,
    string SaleNo,
    Guid? CustomerId,
    string? CustomerName,
    decimal TotalAmount,
    decimal DiscountAmount,
    decimal NetAmount,
    /// <summary>0 = Tutar, 1 = Yüzde, null = indirim yok</summary>
    int? CartDiscountType,
    /// <summary>Yüzde tipinde ise oran (ör. 10 = %10)</summary>
    decimal? CartDiscountPercentage,
    DateTime CreatedAt,
    IReadOnlyList<SaleItemDto> Items);

public record SaleItemDto(
    Guid Id,
    Guid ProductId,
    string ProductCode,
    string ProductName,
    decimal Quantity,
    decimal UnitPrice,
    decimal ProductDiscountAmount,
    decimal DiscountAmount,
    string? DiscountName,
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
