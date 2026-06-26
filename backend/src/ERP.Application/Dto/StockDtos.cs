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
    bool IsCancelled,
    DateTime CreatedAt);

/// <summary>
/// Allowed inward movement types: Purchase=1, ReturnIn=3, StockCount=5, TransferIn=6
/// </summary>
public record AddStockMovementRequest(
    Guid ProductId,
    Guid WarehouseId,
    int Type,
    decimal Quantity,
    decimal UnitPrice);

