using ERP.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ERP.Application.Abstractions;

public interface IErpDbContext
{
    DbSet<Brand> Brands { get; }
    DbSet<Category> Categories { get; }
    DbSet<Customer> Customers { get; }
    DbSet<Product> Products { get; }
    DbSet<Sale> Sales { get; }
    DbSet<SaleItem> SaleItems { get; }
    DbSet<StockMovement> StockMovements { get; }
    DbSet<Terminal> Terminals { get; }
    DbSet<Unit> Units { get; }
    DbSet<User> Users { get; }
    DbSet<Warehouse> Warehouses { get; }
    DbSet<SystemSetting> SystemSettings { get; }
    DbSet<SystemLog> SystemLogs { get; }

    Task<IErpTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default);
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

