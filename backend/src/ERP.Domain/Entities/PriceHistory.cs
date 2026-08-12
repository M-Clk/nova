namespace ERP.Domain.Entities;

public class PriceHistory
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public decimal OldPurchasePrice { get; set; }
    public decimal NewPurchasePrice { get; set; }
    public decimal OldSalePrice { get; set; }
    public decimal NewSalePrice { get; set; }
    public string ChangedBy { get; set; } = string.Empty;
    public Guid BatchId { get; set; }
    public bool IsReverted { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Product? Product { get; set; }
}
