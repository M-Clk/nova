namespace ERP.Domain.Entities;

public class Sale
{
    public Guid Id { get; set; }
    public string SaleNo { get; set; } = string.Empty;
    public Guid? CustomerId { get; set; }
    public Guid? TerminalId { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal NetAmount { get; set; }
    /// <summary>Sepet indirim tipi: 0 = Tutar, 1 = Yüzde</summary>
    public int? CartDiscountType { get; set; }
    /// <summary>Yüzde tipinde girilmişse oranın kendisi (ör. 10 → %10)</summary>
    public decimal? CartDiscountPercentage { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Customer? Customer { get; set; }
    public Terminal? Terminal { get; set; }
    public ICollection<SaleItem> Items { get; set; } = new List<SaleItem>();
}
