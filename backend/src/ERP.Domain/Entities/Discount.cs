namespace ERP.Domain.Entities;

public enum DiscountScope
{
    All = 0,
    Category = 1,
    Brand = 2,
    Product = 3
}

public enum DiscountType
{
    Percentage = 0,
    FixedAmount = 1
}

public class Discount
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DiscountScope Scope { get; set; }
    public Guid? TargetId { get; set; }
    public DiscountType Type { get; set; }
    public decimal Value { get; set; }
    public bool IsActive { get; set; } = true;
    public int Priority { get; set; }

    // ── Tarih Aralığı ──
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }

    // ── Tekrarlayan Zamanlama ──
    public string? DaysOfWeek { get; set; }      // "0,6" → Pazar+Cumartesi
    public TimeOnly? StartTime { get; set; }
    public TimeOnly? EndTime { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
