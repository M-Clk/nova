namespace ERP.Domain.Entities;

public class Terminal
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public Guid WarehouseId { get; set; }
    public bool IsActive { get; set; } = true;
    public Warehouse? Warehouse { get; set; }
    public ICollection<Sale> Sales { get; set; } = new List<Sale>();
}
