using ERP.Application.Abstractions;
using ERP.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ERP.Infrastructure.Persistence;

public class ErpDbContext(DbContextOptions<ErpDbContext> options) : DbContext(options), IErpDbContext
{
    public DbSet<Brand> Brands => Set<Brand>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleItem> SaleItems => Set<SaleItem>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<Terminal> Terminals => Set<Terminal>();
    public DbSet<Unit> Units => Set<Unit>();
    public DbSet<Warehouse> Warehouses => Set<Warehouse>();

    public async Task<IErpTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default)
    {
        var transaction = await Database.BeginTransactionAsync(cancellationToken);
        return new EfCoreErpTransaction(transaction);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Brand>(entity =>
        {
            entity.ToTable("Brands");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(120).IsRequired();
            entity.HasIndex(x => x.Name).IsUnique();
            entity.HasData(new Brand { Id = SeedIds.BrandId, Name = "Genel" });
        });

        modelBuilder.Entity<Category>(entity =>
        {
            entity.ToTable("Categories");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(120).IsRequired();
            entity.HasOne(x => x.Parent).WithMany(x => x.Children).HasForeignKey(x => x.ParentId).OnDelete(DeleteBehavior.Restrict);
            entity.HasData(new Category { Id = SeedIds.CategoryId, Name = "Genel" });
        });

        modelBuilder.Entity<Unit>(entity =>
        {
            entity.ToTable("Units");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Code).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(80).IsRequired();
            entity.HasIndex(x => x.Code).IsUnique();
            entity.HasData(new Unit { Id = SeedIds.UnitId, Code = "ADET", Name = "Adet" });
        });

        modelBuilder.Entity<Warehouse>(entity =>
        {
            entity.ToTable("Warehouses");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(120).IsRequired();
            entity.HasIndex(x => x.Name).IsUnique();
            entity.HasData(new Warehouse { Id = SeedIds.WarehouseId, Name = "Ana Depo" });
        });

        modelBuilder.Entity<Terminal>(entity =>
        {
            entity.ToTable("Terminals");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Code).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(120).IsRequired();
            entity.Property(x => x.IsActive).HasDefaultValue(true);
            entity.HasIndex(x => x.Code).IsUnique();
            entity.HasOne(x => x.Warehouse).WithMany().HasForeignKey(x => x.WarehouseId).OnDelete(DeleteBehavior.Restrict);
            entity.HasData(
                new Terminal { Id = SeedIds.Terminal1Id, Code = "KASA-1", Name = "Kasa 1", WarehouseId = SeedIds.WarehouseId, IsActive = true },
                new Terminal { Id = SeedIds.Terminal2Id, Code = "KASA-2", Name = "Kasa 2", WarehouseId = SeedIds.WarehouseId, IsActive = true },
                new Terminal { Id = SeedIds.Terminal3Id, Code = "KASA-3", Name = "Kasa 3", WarehouseId = SeedIds.WarehouseId, IsActive = true }
            );
        });

        modelBuilder.Entity<Customer>(entity =>
        {
            entity.ToTable("Customers");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Code).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Phone).HasMaxLength(40);
            entity.HasIndex(x => x.Code).IsUnique();
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.ToTable("Products");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Code).HasMaxLength(60).IsRequired();
            entity.Property(x => x.Barcode).HasMaxLength(80);
            entity.Property(x => x.Name).HasMaxLength(180).IsRequired();
            entity.Property(x => x.PurchasePrice).HasPrecision(18, 2);
            entity.Property(x => x.SalePrice).HasPrecision(18, 2);
            entity.Property(x => x.MinStock).HasPrecision(18, 3);
            entity.Property(x => x.IsActive).HasDefaultValue(true);
            entity.HasIndex(x => x.Code).IsUnique();
            entity.HasIndex(x => x.Barcode);
            entity.HasOne(x => x.Brand).WithMany(x => x.Products).HasForeignKey(x => x.BrandId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Category).WithMany(x => x.Products).HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Unit).WithMany(x => x.Products).HasForeignKey(x => x.UnitId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Sale>(entity =>
        {
            entity.ToTable("Sales");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.SaleNo).HasMaxLength(40).IsRequired();
            entity.Property(x => x.TotalAmount).HasPrecision(18, 2);
            entity.Property(x => x.DiscountAmount).HasPrecision(18, 2);
            entity.Property(x => x.NetAmount).HasPrecision(18, 2);
            entity.Property(x => x.CreatedAt).IsRequired();
            entity.HasIndex(x => x.SaleNo).IsUnique();
            entity.HasOne(x => x.Customer).WithMany(x => x.Sales).HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Terminal).WithMany(x => x.Sales).HasForeignKey(x => x.TerminalId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<SaleItem>(entity =>
        {
            entity.ToTable("SaleItems");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Quantity).HasPrecision(18, 3);
            entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
            entity.Property(x => x.DiscountAmount).HasPrecision(18, 2);
            entity.Property(x => x.LineTotal).HasPrecision(18, 2);
            entity.HasOne(x => x.Sale).WithMany(x => x.Items).HasForeignKey(x => x.SaleId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Product).WithMany(x => x.SaleItems).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<StockMovement>(entity =>
        {
            entity.ToTable("StockMovements");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Type).IsRequired();
            entity.Property(x => x.Quantity).HasPrecision(18, 3);
            entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
            entity.Property(x => x.ReferenceType).HasMaxLength(60).IsRequired();
            entity.Property(x => x.CreatedAt).IsRequired();
            entity.HasIndex(x => new { x.ProductId, x.WarehouseId, x.CreatedAt });
            entity.HasOne(x => x.Product).WithMany(x => x.StockMovements).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Warehouse).WithMany(x => x.StockMovements).HasForeignKey(x => x.WarehouseId).OnDelete(DeleteBehavior.Restrict);
        });
    }
}
