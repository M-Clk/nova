using ERP.Application.Abstractions;
using ERP.Application.Dto;
using ERP.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ERP.Application.Services;

public interface ICustomerService
{
    Task<IReadOnlyList<CustomerDto>> GetAsync(CancellationToken cancellationToken = default);
    Task<CustomerDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<CustomerDto> CreateAsync(CreateCustomerRequest request, CancellationToken cancellationToken = default);
    Task<bool> UpdateAsync(Guid id, UpdateCustomerRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}

public class CustomerService(IErpDbContext db) : ICustomerService
{
    public async Task<IReadOnlyList<CustomerDto>> GetAsync(CancellationToken cancellationToken = default)
    {
        return await db.Customers.AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new CustomerDto(x.Id, x.Code, x.Name, x.Phone))
            .ToListAsync(cancellationToken);
    }

    public async Task<CustomerDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await db.Customers.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new CustomerDto(x.Id, x.Code, x.Name, x.Phone))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<CustomerDto> CreateAsync(CreateCustomerRequest request, CancellationToken cancellationToken = default)
    {
        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Code = request.Code.Trim(),
            Name = request.Name.Trim(),
            Phone = request.Phone.Trim()
        };

        db.Customers.Add(customer);
        await db.SaveChangesAsync(cancellationToken);
        return new CustomerDto(customer.Id, customer.Code, customer.Name, customer.Phone);
    }

    public async Task<bool> UpdateAsync(Guid id, UpdateCustomerRequest request, CancellationToken cancellationToken = default)
    {
        var customer = await db.Customers.FindAsync([id], cancellationToken);
        if (customer is null)
        {
            return false;
        }

        customer.Code = request.Code.Trim();
        customer.Name = request.Name.Trim();
        customer.Phone = request.Phone.Trim();
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var customer = await db.Customers.FindAsync([id], cancellationToken);
        if (customer is null)
        {
            return false;
        }

        db.Customers.Remove(customer);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }
}
