namespace ERP.Application.Dto;

public record DiscountDto(
    Guid Id,
    string Name,
    int Scope,
    string ScopeName,
    Guid? TargetId,
    string? TargetName,
    int Type,
    string TypeName,
    decimal Value,
    DateTime? StartDate,
    DateTime? EndDate,
    string? DaysOfWeek,
    string? StartTime,
    string? EndTime,
    bool IsActive,
    bool IsCurrentlyApplicable,
    int Priority,
    DateTime CreatedAt);

public record CreateDiscountRequest(
    string Name,
    int Scope,
    Guid? TargetId,
    int Type,
    decimal Value,
    DateTime? StartDate,
    DateTime? EndDate,
    string? DaysOfWeek,
    string? StartTime,
    string? EndTime,
    int Priority = 0);

public record UpdateDiscountRequest(
    string Name,
    int Scope,
    Guid? TargetId,
    int Type,
    decimal Value,
    DateTime? StartDate,
    DateTime? EndDate,
    string? DaysOfWeek,
    string? StartTime,
    string? EndTime,
    bool IsActive,
    int Priority);
