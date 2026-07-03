namespace ERP.Application.Dto;

public record UserDto(Guid Id, string Username, string? Email, string Role, bool IsActive, DateTime CreatedAt);
public record CreateUserRequest(string Username, string? Email, string Password, string Role);
public record UpdateUserRequest(string Username, string? Email, string Role, bool IsActive, string? NewPassword);
