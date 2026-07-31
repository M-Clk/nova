using ERP.Application.Abstractions;
using ERP.Application.Dto;
using ERP.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ERP.Application.Services;

public interface IDiscountService
{
    Task<IReadOnlyList<DiscountDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<DiscountDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<DiscountDto> CreateAsync(CreateDiscountRequest request, CancellationToken cancellationToken = default);
    Task<DiscountDto> UpdateAsync(Guid id, UpdateDiscountRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Dictionary<Guid, AppliedDiscount>> GetApplicableDiscountsAsync(
        IEnumerable<Product> products, CancellationToken cancellationToken = default);
    Task<AppliedDiscount?> GetApplicableDiscountForProductAsync(
        Product product, CancellationToken cancellationToken = default);
}

public record AppliedDiscount(
    Guid DiscountId,
    string DiscountName,
    DiscountType Type,
    decimal Value,
    decimal DiscountedUnitPrice,
    decimal DiscountAmountPerUnit,
    decimal? DiscountPercentage);

public class DiscountService(IErpDbContext db) : IDiscountService
{
    private static readonly string[] ScopeNames = ["Tümü", "Kategori", "Marka", "Ürün"];
    private static readonly string[] TypeNames = ["Yüzde", "Tutar"];

    public async Task<IReadOnlyList<DiscountDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var discounts = await db.Discounts
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);

        var targetNames = await ResolveTargetNamesAsync(discounts, cancellationToken);
        var now = DateTime.UtcNow;

        return discounts.Select(d => ToDto(d, targetNames.GetValueOrDefault(d.TargetId ?? Guid.Empty), now)).ToList();
    }

    public async Task<DiscountDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var discount = await db.Discounts
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (discount == null) return null;

        var targetNames = await ResolveTargetNamesAsync([discount], cancellationToken);
        return ToDto(discount, targetNames.GetValueOrDefault(discount.TargetId ?? Guid.Empty), DateTime.UtcNow);
    }

    public async Task<DiscountDto> CreateAsync(CreateDiscountRequest request, CancellationToken cancellationToken = default)
    {
        ValidateRequest(request.Scope, request.TargetId, request.Type, request.Value);

        var discount = new Discount
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Scope = (DiscountScope)request.Scope,
            TargetId = request.TargetId,
            Type = (DiscountType)request.Type,
            Value = request.Value,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            DaysOfWeek = NormalizeDaysOfWeek(request.DaysOfWeek),
            StartTime = ParseTimeOnly(request.StartTime),
            EndTime = ParseTimeOnly(request.EndTime),
            Priority = request.Priority,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        db.Discounts.Add(discount);
        await db.SaveChangesAsync(cancellationToken);

        return (await GetByIdAsync(discount.Id, cancellationToken))!;
    }

    public async Task<DiscountDto> UpdateAsync(Guid id, UpdateDiscountRequest request, CancellationToken cancellationToken = default)
    {
        var discount = await db.Discounts
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("İndirim bulunamadı.");

        ValidateRequest(request.Scope, request.TargetId, request.Type, request.Value);

        discount.Name = request.Name.Trim();
        discount.Scope = (DiscountScope)request.Scope;
        discount.TargetId = request.TargetId;
        discount.Type = (DiscountType)request.Type;
        discount.Value = request.Value;
        discount.StartDate = request.StartDate;
        discount.EndDate = request.EndDate;
        discount.DaysOfWeek = NormalizeDaysOfWeek(request.DaysOfWeek);
        discount.StartTime = ParseTimeOnly(request.StartTime);
        discount.EndTime = ParseTimeOnly(request.EndTime);
        discount.IsActive = request.IsActive;
        discount.Priority = request.Priority;

        await db.SaveChangesAsync(cancellationToken);

        return (await GetByIdAsync(discount.Id, cancellationToken))!;
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var discount = await db.Discounts
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("İndirim bulunamadı.");

        db.Discounts.Remove(discount);
        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Birden fazla ürün için şu an geçerli en avantajlı indirimi hesaplar.
    /// </summary>
    public async Task<Dictionary<Guid, AppliedDiscount>> GetApplicableDiscountsAsync(
        IEnumerable<Product> products, CancellationToken cancellationToken = default)
    {
        var activeDiscounts = await GetCurrentlyActiveDiscountsAsync(cancellationToken);
        var result = new Dictionary<Guid, AppliedDiscount>();

        foreach (var product in products)
        {
            var applied = FindBestDiscount(activeDiscounts, product);
            if (applied != null)
            {
                result[product.Id] = applied;
            }
        }

        return result;
    }

    /// <summary>
    /// Tek bir ürün için şu an geçerli en avantajlı indirimi hesaplar.
    /// </summary>
    public async Task<AppliedDiscount?> GetApplicableDiscountForProductAsync(
        Product product, CancellationToken cancellationToken = default)
    {
        var activeDiscounts = await GetCurrentlyActiveDiscountsAsync(cancellationToken);
        return FindBestDiscount(activeDiscounts, product);
    }

    // ── Private Helpers ──────────────────────────────────────────────────────

    private async Task<List<Discount>> GetCurrentlyActiveDiscountsAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        // DB'den aktif ve tarih aralığında olanları çek
        var discounts = await db.Discounts
            .AsNoTracking()
            .Where(d => d.IsActive)
            .Where(d => d.StartDate == null || d.StartDate <= now)
            .Where(d => d.EndDate == null || d.EndDate >= now)
            .ToListAsync(cancellationToken);

        // Gün ve saat filtresini bellekte uygula (TimeOnly DB desteği değişken)
        var currentDayOfWeek = (int)now.DayOfWeek;
        var currentTime = TimeOnly.FromDateTime(now);

        return discounts.Where(d =>
        {
            // Gün kontrolü
            if (!string.IsNullOrEmpty(d.DaysOfWeek))
            {
                var allowedDays = d.DaysOfWeek.Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(s => int.TryParse(s.Trim(), out var v) ? v : -1)
                    .Where(v => v >= 0 && v <= 6)
                    .ToHashSet();

                if (!allowedDays.Contains(currentDayOfWeek))
                    return false;
            }

            // Saat kontrolü
            if (d.StartTime.HasValue && currentTime < d.StartTime.Value)
                return false;
            if (d.EndTime.HasValue && currentTime > d.EndTime.Value)
                return false;

            return true;
        }).ToList();
    }

    private static AppliedDiscount? FindBestDiscount(List<Discount> activeDiscounts, Product product)
    {
        var applicableDiscounts = activeDiscounts.Where(d =>
        {
            return d.Scope switch
            {
                DiscountScope.Product => d.TargetId == product.Id,
                DiscountScope.Brand => d.TargetId == product.BrandId,
                DiscountScope.Category => d.TargetId == product.CategoryId,
                DiscountScope.All => true,
                _ => false
            };
        }).ToList();

        if (applicableDiscounts.Count == 0)
            return null;

        // Her indirim için ₺ tutarını hesapla ve en avantajlısını seç
        AppliedDiscount? best = null;

        foreach (var discount in applicableDiscounts)
        {
            var discountAmountPerUnit = CalculateDiscountAmount(discount, product.SalePrice);
            if (discountAmountPerUnit <= 0) continue;

            // İndirim fiyattan fazla olamaz
            discountAmountPerUnit = Math.Min(discountAmountPerUnit, product.SalePrice);

            var discountedPrice = product.SalePrice - discountAmountPerUnit;
            var percentage = product.SalePrice > 0
                ? Math.Round(discountAmountPerUnit / product.SalePrice * 100, 1)
                : 0;

            if (best == null || discountAmountPerUnit > best.DiscountAmountPerUnit ||
                (discountAmountPerUnit == best.DiscountAmountPerUnit && discount.Priority > GetDiscountPriorityScore(discount, best)))
            {
                best = new AppliedDiscount(
                    discount.Id,
                    discount.Name,
                    discount.Type,
                    discount.Value,
                    discountedPrice,
                    discountAmountPerUnit,
                    percentage);
            }
        }

        return best;
    }

    private static decimal CalculateDiscountAmount(Discount discount, decimal unitPrice)
    {
        return discount.Type switch
        {
            DiscountType.Percentage => Math.Round(unitPrice * discount.Value / 100, 2),
            DiscountType.FixedAmount => discount.Value,
            _ => 0
        };
    }

    private static int GetDiscountPriorityScore(Discount discount, AppliedDiscount currentBest)
    {
        // Daha spesifik scope, daha yüksek öncelik
        return (int)discount.Scope * 100 + discount.Priority;
    }

    private async Task<Dictionary<Guid, string>> ResolveTargetNamesAsync(
        IReadOnlyList<Discount> discounts, CancellationToken cancellationToken)
    {
        var result = new Dictionary<Guid, string>();

        var productTargets = discounts.Where(d => d.Scope == DiscountScope.Product && d.TargetId.HasValue).Select(d => d.TargetId!.Value).Distinct().ToArray();
        var brandTargets = discounts.Where(d => d.Scope == DiscountScope.Brand && d.TargetId.HasValue).Select(d => d.TargetId!.Value).Distinct().ToArray();
        var categoryTargets = discounts.Where(d => d.Scope == DiscountScope.Category && d.TargetId.HasValue).Select(d => d.TargetId!.Value).Distinct().ToArray();

        if (productTargets.Length > 0)
        {
            var names = await db.Products.AsNoTracking()
                .Where(p => productTargets.Contains(p.Id))
                .Select(p => new { p.Id, p.Name })
                .ToListAsync(cancellationToken);
            foreach (var n in names) result[n.Id] = n.Name;
        }

        if (brandTargets.Length > 0)
        {
            var names = await db.Brands.AsNoTracking()
                .Where(b => brandTargets.Contains(b.Id))
                .Select(b => new { b.Id, b.Name })
                .ToListAsync(cancellationToken);
            foreach (var n in names) result[n.Id] = n.Name;
        }

        if (categoryTargets.Length > 0)
        {
            var names = await db.Categories.AsNoTracking()
                .Where(c => categoryTargets.Contains(c.Id))
                .Select(c => new { c.Id, c.Name })
                .ToListAsync(cancellationToken);
            foreach (var n in names) result[n.Id] = n.Name;
        }

        return result;
    }

    private static bool IsCurrentlyApplicable(Discount d, DateTime now)
    {
        if (!d.IsActive) return false;
        if (d.StartDate.HasValue && now < d.StartDate.Value) return false;
        if (d.EndDate.HasValue && now > d.EndDate.Value) return false;

        if (!string.IsNullOrEmpty(d.DaysOfWeek))
        {
            var currentDay = (int)now.DayOfWeek;
            var allowedDays = d.DaysOfWeek.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(s => int.TryParse(s.Trim(), out var v) ? v : -1)
                .Where(v => v >= 0 && v <= 6)
                .ToHashSet();
            if (!allowedDays.Contains(currentDay)) return false;
        }

        var currentTime = TimeOnly.FromDateTime(now);
        if (d.StartTime.HasValue && currentTime < d.StartTime.Value) return false;
        if (d.EndTime.HasValue && currentTime > d.EndTime.Value) return false;

        return true;
    }

    private DiscountDto ToDto(Discount d, string? targetName, DateTime now)
    {
        return new DiscountDto(
            d.Id,
            d.Name,
            (int)d.Scope,
            ScopeNames[(int)d.Scope],
            d.TargetId,
            targetName,
            (int)d.Type,
            TypeNames[(int)d.Type],
            d.Value,
            d.StartDate,
            d.EndDate,
            d.DaysOfWeek,
            d.StartTime?.ToString("HH:mm"),
            d.EndTime?.ToString("HH:mm"),
            d.IsActive,
            IsCurrentlyApplicable(d, now),
            d.Priority,
            d.CreatedAt);
    }

    private static void ValidateRequest(int scope, Guid? targetId, int type, decimal value)
    {
        if (scope < 0 || scope > 3)
            throw new InvalidOperationException("Geçersiz indirim kapsamı.");
        if (type < 0 || type > 1)
            throw new InvalidOperationException("Geçersiz indirim tipi.");
        if (value <= 0)
            throw new InvalidOperationException("İndirim değeri sıfırdan büyük olmalıdır.");
        if (type == (int)DiscountType.Percentage && value > 100)
            throw new InvalidOperationException("Yüzde indirimi 100'den büyük olamaz.");
        if (scope != (int)DiscountScope.All && !targetId.HasValue)
            throw new InvalidOperationException("Kapsam 'Tümü' değilse hedef seçilmelidir.");
    }

    private static string? NormalizeDaysOfWeek(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var days = value.Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(s => s.Trim())
            .Where(s => int.TryParse(s, out var v) && v >= 0 && v <= 6)
            .Distinct()
            .OrderBy(s => s);
        var result = string.Join(",", days);
        return string.IsNullOrEmpty(result) ? null : result;
    }

    private static TimeOnly? ParseTimeOnly(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return TimeOnly.TryParse(value, out var time) ? time : null;
    }
}
