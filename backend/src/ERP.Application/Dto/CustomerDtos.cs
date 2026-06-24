namespace ERP.Application.Dto;

public record CustomerDto(Guid Id, string Code, string Name, string Phone);
public record CreateCustomerRequest(string Code, string Name, string Phone);
public record UpdateCustomerRequest(string Code, string Name, string Phone);
