namespace ERP.Domain.Entities;

public class Sale
{
    public Guid Id { get; set; }
    public string SaleNo { get; set; } = string.Empty;
    public Guid? CustomerId { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal NetAmount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Customer? Customer { get; set; }
    public ICollection<SaleItem> Items { get; set; } = new List<SaleItem>();
}
