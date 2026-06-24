namespace ERP.Domain.Entities;

public class Customer
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public ICollection<Sale> Sales { get; set; } = new List<Sale>();
}
