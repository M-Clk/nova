using ERP.Domain.Entities;

namespace ERP.Application.Dto;

public record CurrentStockDto(
    Guid ProductId,
    string ProductCode,
    string ProductName,
    Guid WarehouseId,
    string WarehouseName,
    decimal Quantity);

public record StockMovementDto(
    Guid Id,
    Guid ProductId,
    string ProductCode,
    string ProductName,
    Guid WarehouseId,
    string WarehouseName,
    StockMovementType Type,
    decimal Quantity,
    decimal UnitPrice,
    string ReferenceType,
    Guid? ReferenceId,
    DateTime CreatedAt);
