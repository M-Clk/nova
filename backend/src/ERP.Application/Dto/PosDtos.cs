namespace ERP.Application.Dto;

public record TerminalDto(
    Guid Id,
    string Code,
    string Name,
    Guid WarehouseId,
    string WarehouseName,
    bool IsActive);

public record CreateTerminalRequest(string Code, string Name, Guid WarehouseId);
public record UpdateTerminalRequest(string Code, string Name, Guid WarehouseId, bool IsActive);

public record PosProductDto(
    Guid Id,
    string Barcode,
    string Name,
    decimal SalePrice,
    decimal? DiscountedPrice,
    string? DiscountName,
    decimal? DiscountPercentage);

public record PosCheckoutRequest(
    Guid? CustomerId,
    Guid TerminalId,
    IReadOnlyList<PosCheckoutItemRequest> Items,
    decimal DiscountAmount = 0,
    /// <summary>0 = Tutar, 1 = Yüzde</summary>
    int DiscountType = 0,
    /// <summary>Yüzde tipinde ise oranın kendisi (ör. 10 = %10)</summary>
    decimal? DiscountPercentage = null);

public record PosCheckoutItemRequest(
    Guid ProductId,
    decimal Quantity);

public record PosCheckoutResult(
    Guid SaleId,
    string SaleNo,
    decimal TotalAmount,
    decimal NetAmount);
