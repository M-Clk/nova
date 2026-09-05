using ERP.Application.Abstractions;
using ERP.Application.Dto;
using ERP.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ERP.Application.Services;

// ─── Interface ────────────────────────────────────────────────────────────────

public interface IProductBrandSuggestionService
{
    /// <summary>Ürün adından marka önerisi üretir. DB bağlantısı gerektirmez.</summary>
    BrandSuggestionDto? Suggest(string productName);
}

// ─── Kural Motoru (Singleton) ─────────────────────────────────────────────────

/// <summary>
/// Ürün adlarından marka adını tespit eden kural motoru.
/// Singleton — statik, thread-safe, DB bağlantısı yoktur.
/// </summary>
public sealed class ProductBrandSuggestionService : IProductBrandSuggestionService
{
    // Her kural: (Marka adı görünen hali, Güven skoru, Tetikleyici anahtar kelimeler)
    // Listedeki sıra öncelik sırasıdır — ilk eşleşen kazanır.
    private static readonly IReadOnlyList<BrandRule> Rules = new List<BrandRule>
    {
        // ── Kırtasiye Markaları ───────────────────────────────────────────────
        new("Faber-Castell",  0.97, "FABER CASTELL", "FABER-CASTELL"),
        new("Faber-Castell",  0.90, "FABER"),
        new("Pensan",         0.97, "PENSAN"),
        new("Noki",           0.97, "NOKİ", "NOKI"),
        new("Osaca",          0.95, "OSACA"),
        new("Trix",           0.95, "TRİX", "TRIX"),
        new("Castel",         0.95, "CASTEL"),
        new("More",           0.90, "MORE KALEM", "MORE TÜKENMEZ"),
        new("Artline",        0.97, "ARTLİNE", "ARTLINE"),
        new("Staedtler",      0.97, "STAEDTLER"),
        new("Pilot",          0.95, "PİLOT KALEM", "PILOT KALEM"),
        new("Stabilo",        0.97, "STABİLO", "STABILO"),
        new("Uni",            0.95, "UNİ KALEM", "UNI KALEM"),
        new("Bic",            0.97, "BİC", "BIC KALEM"),
        new("Forofis",        0.97, "FOROFİS", "FOROFIS"),
        new("Linc",           0.95, "LİNC", "LINC"),
        new("Edding",         0.97, "EDDİNG", "EDDING"),
        new("Giotto",         0.97, "GİOTTO", "GIOTTO"),
        new("Crayola",        0.97, "CRAYOLA"),
        new("Koh-I-Noor",     0.97, "KOH-I-NOOR", "KOH I NOOR"),
        new("Deli",           0.95, "DELİ KALEM", "DELI KALEM", "DELİ DEFTER"),
        new("Mikro",          0.85, "MİKRO KALEM", "MIKRO KALEM"),  // Mikro marka
        new("Subaru",         0.95, "SUBARU KALEM", "SUBARU UÇLU"),
        new("Yenilmezler",    0.95, "YENİLMEZLER"),
        new("Tokaç",          0.97, "TOKAÇ", "TOKAC"),
        new("Brons",          0.97, "BRONS"),

        // ── Yayınevleri / Eğitim Yayınları ───────────────────────────────────
        new("Palme Yayınevi", 0.97, "PALME"),
        new("Fenomen Yayıncılık", 0.97, "FENOMEN"),
        new("Karekök Yayınları", 0.97, "KAREKÖK", "KAREKOK"),
        new("Esen Yayınları", 0.97, "ESEN BİYOLOJİ", "ESEN MATEMATİK",
                                     "ESEN FİZİK", "ESEN KİMYA", "ESEN TARİH",
                                     "ESEN TÜRKÇE", "ESEN COĞRAFYA"),
        new("Esen Yayınları", 0.90, "ESEN"),
        new("Okyanus Yayınları", 0.97, "OKYANUS"),
        new("Ankara Yayıncılık", 0.95, "ANKARA YAYINLARI", "ANKARA YAYIN"),
        new("Damla Yayınevi", 0.97, "DAMLA"),
        new("Bilfen Yayıncılık", 0.97, "BİLFEN", "BILFEM"),
        new("Özgün Yayınları", 0.97, "ÖZGÜN", "OZGUN"),
        new("İnkılap Kitabevi", 0.97, "İNKILAP", "INKILAP"),
        new("Berkay Yayıncılık", 0.97, "BERKAY"),
        new("Miray Yayınları", 0.97, "MİRAY", "MIRAY"),
        new("Editör Yayınları", 0.97, "EDİTÖR", "EDITOR"),
        new("Astral Yayıncılık", 0.95, "ASTRAL"),
        new("KVA Yayınları",  0.97, "KVA"),
        new("Hız ve Renk",    0.97, "HIZ VE RENK"),
        new("Hız Yayınları",  0.90, "HIZ"),
        new("Tudem Yayınları",0.97, "TUDEM"),
        new("Nitelik Yayınları", 0.97, "NİTELİK", "NITELIK"),
        new("Ata Yayıncılık", 0.90, "ATA YAYINLARI", "ATA YAYIN"),
        new("Seviye Yayınları",0.90,"SEVİYE YAYINLARI", "SEVIYE YAYIN"),
        new("Not Yayınları",  0.90, "NOT YAYINLARI"),
        new("Dönem Yayınları",0.90, "DÖNEM YAYINLARI", "DONEM YAYIN"),
        new("Karekök Yayınları", 0.85, "KAREKÖK"),
        new("Aydın Yayınları",0.90, "AYDIN YAYINLARI", "AYDIN YAYIN"),
        new("Özgün Yayınları",0.85, "ÖZGÜN"),

        // ── Çanta Markaları ───────────────────────────────────────────────────
        new("Hakan",          0.97, "HAKAN ÇANTA", "HAKAN OKUL"),
        new("Kaukko",         0.97, "KAUKKO"),
        new("Target",         0.97, "TARGET ÇANTA"),
        new("Zenit",          0.97, "ZENİT ÇANTA", "ZENIT CANTA"),

        // ── Oyun / Eğitici Markalar ───────────────────────────────────────────
        new("Lego",           0.99, "LEGO"),
        new("Ravensburger",   0.99, "RAVENSBURGEer", "RAVENSBURGER"),
        new("Step",           0.95, "STEP PUZZLE", "STEP YAPBOZ"),
        new("Art Çocuk",      0.95, "ART ÇOCUK", "ART COCUK"),

        // ── Fatih Kırtasiye ───────────────────────────────────────────────────
        new("Fatih",          0.97, "FATİH KALEMCİLİK", "FATİH OYUN"),
    };

    private static string Normalize(string input) =>
        input.Trim().ToUpperInvariant();

    /// <inheritdoc/>
    public BrandSuggestionDto? Suggest(string productName)
    {
        if (string.IsNullOrWhiteSpace(productName))
            return null;

        var normalized = Normalize(productName);

        foreach (var rule in Rules)
        {
            foreach (var keyword in rule.Keywords)
            {
                if (normalized.Contains(keyword, StringComparison.OrdinalIgnoreCase))
                {
                    return new BrandSuggestionDto(
                        SuggestedBrandName: rule.BrandName,
                        ConfidenceScore: rule.Confidence,
                        MatchedKeyword: keyword,
                        SuggestedBrandId: null);
                }
            }
        }

        return null;
    }

    private sealed record BrandRule(string BrandName, double Confidence, params string[] Keywords);
}

// ─── Scoped DB Wrapper ────────────────────────────────────────────────────────

public interface IProductBrandAssignmentDbService
{
    Task<BrandSuggestionDto?> SuggestAsync(string productName, CancellationToken ct = default);
    Task<BulkBrandSuggestionResult> PreviewBulkAsync(IReadOnlyList<Guid>? productIds, bool onlyUnbranded, CancellationToken ct = default);
    Task<BulkBrandUpdateResult> ApplyBulkAsync(IReadOnlyList<Guid>? productIds, bool onlyUnbranded, CancellationToken ct = default);
}

public sealed class ProductBrandAssignmentDbService(
    IErpDbContext db,
    IProductBrandSuggestionService engine) : IProductBrandAssignmentDbService
{
    private static readonly HashSet<string> GenelBrandNames =
        new(StringComparer.OrdinalIgnoreCase) { "Genel", "GENEL", "General", "Bilinmiyor" };

    public async Task<BrandSuggestionDto?> SuggestAsync(string productName, CancellationToken ct = default)
    {
        var suggestion = engine.Suggest(productName);
        if (suggestion is null) return null;

        var brand = await db.Brands.AsNoTracking()
            .FirstOrDefaultAsync(b => b.Name.ToLower() == suggestion.SuggestedBrandName.ToLower(), ct);

        return suggestion with { SuggestedBrandId = brand?.Id };
    }

    public async Task<BulkBrandSuggestionResult> PreviewBulkAsync(
        IReadOnlyList<Guid>? productIds,
        bool onlyUnbranded,
        CancellationToken ct = default)
    {
        var products = await BuildQueryAsync(productIds, onlyUnbranded, ct);

        var existingBrands = await db.Brands.AsNoTracking()
            .ToDictionaryAsync(b => b.Name.Trim(), b => b.Id, StringComparer.OrdinalIgnoreCase, ct);

        var suggestions = new List<ProductBrandSuggestionItem>(products.Count);

        foreach (var p in products)
        {
            var raw = engine.Suggest(p.Name);
            BrandSuggestionDto? withId = null;

            if (raw is not null)
            {
                existingBrands.TryGetValue(raw.SuggestedBrandName, out var brandId);
                withId = raw with { SuggestedBrandId = brandId == Guid.Empty ? null : brandId };
            }

            suggestions.Add(new ProductBrandSuggestionItem(
                p.Id, p.Code, p.Name,
                p.Brand?.Name ?? "—",
                withId));
        }

        return new BulkBrandSuggestionResult(
            TotalProducts: suggestions.Count,
            MatchedCount: suggestions.Count(s => s.Suggestion is not null),
            UnmatchedCount: suggestions.Count(s => s.Suggestion is null),
            Suggestions: suggestions);
    }

    public async Task<BulkBrandUpdateResult> ApplyBulkAsync(
        IReadOnlyList<Guid>? productIds,
        bool onlyUnbranded,
        CancellationToken ct = default)
    {
        var products = await BuildQueryAsync(productIds, onlyUnbranded, ct);

        var brandCache = await db.Brands
            .ToDictionaryAsync(b => b.Name.Trim(), b => b, StringComparer.OrdinalIgnoreCase, ct);

        var createdBrandNames = new List<string>();
        int updated = 0, skipped = 0, unmatched = 0;

        foreach (var product in products)
        {
            var raw = engine.Suggest(product.Name);
            if (raw is null)
            {
                unmatched++;
                continue;
            }

            var brandName = raw.SuggestedBrandName;

            // Marka yoksa otomatik oluştur
            if (!brandCache.TryGetValue(brandName, out var brand))
            {
                brand = new Brand { Id = Guid.NewGuid(), Name = brandName };
                db.Brands.Add(brand);
                brandCache[brandName] = brand;
                createdBrandNames.Add(brandName);
            }

            if (product.BrandId == brand.Id)
            {
                skipped++;
                continue;
            }

            product.BrandId = brand.Id;
            updated++;
        }

        await db.SaveChangesAsync(ct);

        return new BulkBrandUpdateResult(
            UpdatedCount: updated,
            SkippedCount: skipped,
            UnmatchedCount: unmatched,
            CreatedBrands: createdBrandNames);
    }

    private async Task<List<Product>> BuildQueryAsync(
        IReadOnlyList<Guid>? productIds,
        bool onlyUnbranded,
        CancellationToken ct)
    {
        var query = db.Products.Include(p => p.Brand).AsQueryable();

        if (productIds is { Count: > 0 })
            query = query.Where(p => productIds.Contains(p.Id));

        if (onlyUnbranded)
            query = query.Where(p =>
                p.Brand == null ||
                GenelBrandNames.Contains(p.Brand.Name));

        return await query.ToListAsync(ct);
    }
}
