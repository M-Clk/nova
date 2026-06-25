namespace ERP.Application.Dto;

public record TerminalDto(
    Guid Id,
    string Code,
    string Name,
    Guid WarehouseId,
    bool IsActive);

public record PosProductDto(
    Guid Id,
    string Barcode,
    string Name,
    decimal SalePrice);

public record PosCheckoutRequest(
    Guid? CustomerId,
    Guid TerminalId,
    IReadOnlyList<PosCheckoutItemRequest> Items);

public record PosCheckoutItemRequest(
    Guid ProductId,
    decimal Quantity);

public record PosCheckoutResult(
    Guid SaleId,
    string SaleNo,
    decimal TotalAmount,
    decimal NetAmount);
