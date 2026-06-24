namespace ERP.Domain.Entities;

public class Warehouse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public ICollection<StockMovement> StockMovements { get; set; } = new List<StockMovement>();
}
