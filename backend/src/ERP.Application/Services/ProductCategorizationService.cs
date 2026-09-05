using ERP.Application.Abstractions;
using ERP.Application.Dto;
using ERP.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ERP.Application.Services;

// ─── Interface ────────────────────────────────────────────────────────────────

public interface IProductCategorizationService
{
    /// <summary>
    /// Ürün adına bakarak kategori önerisi üretir. DB bağlantısı gerektirmez.
    /// </summary>
    CategorySuggestionDto? Suggest(string productName);

    /// <summary>
    /// Ürün adı listesi için toplu öneri üretir (DB gerektirmez).
    /// </summary>
    IReadOnlyList<(string ProductName, CategorySuggestionDto? Suggestion)> SuggestBulk(
        IEnumerable<string> productNames);
}

// ─── Kural Motoru ─────────────────────────────────────────────────────────────

/// <summary>
/// Ürün adlarını anahtar kelime kurallarıyla otomatik kategorize eden servis.
/// Singleton olarak kayıtlıdır — statik, thread-safe, DB bağlantısı yoktur.
/// </summary>
public sealed class ProductCategorizationService : IProductCategorizationService
{
    // ─── Kategori kuralları (öncelik sırasına göre) ───────────────────────────
    // Her kural: (Kategori adı, Güven skoru, Tetikleyici anahtar kelimeler)
    // Kural listesi yukarıdan aşağıya değerlendirilir; ilk eşleşen kazanır.
    private static readonly IReadOnlyList<CategoryRule> Rules = new List<CategoryRule>
    {
        // ── Sınav Kitapları ──────────────────────────────────────────────────
        new("Sınav Kitabı", 0.95,
            "TYT", "AYT", "YKS", "LGS", "KPSS", "DGS", "YGS",
            "SORU BANKASI", "DENEME SINAVI", "DENEME SETI", "ÇÖZÜMLÜ TEST"),

        // ── Ders Kitabı + Sınıf ifadesi ─────────────────────────────────────
        new("Ders Kitabı", 0.90,
            "1.SINIF", "2.SINIF", "3.SINIF", "4.SINIF",
            "5.SINIF", "6.SINIF", "7.SINIF", "8.SINIF",
            "9.SINIF", "10.SINIF", "11.SINIF", "12.SINIF",
            "1 SINIF", "2 SINIF", "3 SINIF", "4 SINIF",
            "5 SINIF", "6 SINIF", "7 SINIF", "8 SINIF",
            "9 SINIF", "10 SINIF", "11 SINIF", "12 SINIF",
            "1.SNF", "2.SNF", "3.SNF", "4.SNF",
            "5.SNF", "6.SNF", "7.SNF", "8.SNF",
            "9.SNF", "10.SNF", "11.SNF", "12.SNF",
            "KONU ANLATIMI", "YAPRAK TEST", "FASIKÜL"),

        // ── Hikaye / Roman / Çocuk Kitabı ────────────────────────────────────
        new("Kitap", 0.88,
            "HİKAYE", "HIKAYE", "ROMAN", "MASAL", "ÖYKÜ", "OYKU",
            "ÇOCUK KİTABI", "COCUK KİTABI", "OKUMA KİTABI",
            "100 TEMEL ESER", "DÜNYA KLASİKLERİ"),

        // ── Kalem türleri ─────────────────────────────────────────────────────
        new("Kalem", 0.95,
            "TÜKENMEZ", "TUKENMEZ", "UÇLU KALEM", "UCLU KALEM",
            "MİKRO KALEM", "MIKRO KALEM", "VERSATİL", "VERSATIL",
            "FOSFORLU KALEM", "KEÇELİ KALEM", "KECELI KALEM",
            "GEL KALEM", "MARKER KALEM", "İŞARETLEYİCİ",
            "LINER", "FINELINER",
            "DOLMA KALEM", "DOLMAKALEM"),

        // ── Kalem (genel – düşük öncelik, yukarıdaki özel kurallar önce gelir) ─
        new("Kalem", 0.80, "KALEM"),

        // ── Kalem Ucu ─────────────────────────────────────────────────────────
        new("Kalem Ucu", 0.92,
            "KALEM UCU", "UÇLU UC", "MİKRO UC", "DIAMOND UC",
            "0,5 UC", "0,7 UC", "0,9 UC",
            "05 UC", "07 UC", "09 UC"),

        // ── Defter ────────────────────────────────────────────────────────────
        new("Defter", 0.93,
            "SPİRALLİ DEFTER", "SPIRALLI DEFTER",
            "KARELİ DEFTER", "KARELI DEFTER",
            "ÇİZGİLİ DEFTER", "CIZGILI DEFTER",
            "BLOKNOT", "AJANDA", "GÜNLÜK",
            "DEFTERİ", "DEFTERI"),

        // ── Defter (genel) ────────────────────────────────────────────────────
        new("Defter", 0.82, "DEFTER"),

        // ── Silgi ─────────────────────────────────────────────────────────────
        new("Silgi", 0.95, "SİLGİ", "SILGI", "TAHTA SİLGİSİ", "TAHTA SILGISI"),

        // ── Kalemtıraş ───────────────────────────────────────────────────────
        new("Kalemtıraş", 0.95, "KALEMTİRAŞ", "KALEMTIRAS", "KALEM TIRASI"),

        // ── Boyama & Sanat ────────────────────────────────────────────────────
        new("Boyama & Sanat", 0.93,
            "SULUBOYA", "SULU BOYA", "GUAJ", "AKRİLİK", "AKRILIK",
            "PASTEL BOYA", "YAĞLIBOYA", "YAGLIBOYA",
            "KÖK BOYA", "KOK BOYA", "FİNEL", "FINEL",
            "BOYA KALEMİ", "BOYA KALEMI",
            "BOYA SETI", "BOYA SETİ"),

        // ── Boya (genel) ──────────────────────────────────────────────────────
        new("Boyama & Sanat", 0.78, "BOYA"),

        // ── El İşi & Kağıt ────────────────────────────────────────────────────
        new("El İşi & Kağıt", 0.92,
            "FON KARTONU", "FON KARTON",
            "EL İŞİ KAĞIDI", "EL ISI KAGIDI",
            "KRAFT KAĞIT", "KRAFT KAGIT",
            "EVA KAĞIDI", "EVA KAGIT",
            "ORIGAMI", "RESIM KAGIDI", "RESİM KAĞIDI",
            "GFON", "10 LU FON", "10LU FON"),

        // ── Çanta ─────────────────────────────────────────────────────────────
        new("Çanta", 0.93,
            "OKUL ÇANTASI", "OKUL CANTASI",
            "SIRT ÇANTASI", "SIRT CANTASI",
            "ÇANTASI", "CANTASI"),

        // ── Çanta (genel) ─────────────────────────────────────────────────────
        new("Çanta", 0.82, "ÇANTA", "CANTA"),

        // ── Geometri Araçları ─────────────────────────────────────────────────
        new("Geometri Araçları", 0.95,
            "CETVEL", "GÖNYE", "GONYE", "AÇIÖLÇER", "ACIОЛÇER",
            "PERGEL", "GEOMETRİ SETİ", "GEOMETRI SETI",
            "İLETKİ", "ILETKI"),

        // ── Makas ────────────────────────────────────────────────────────────
        new("Makas", 0.95, "MAKAS"),

        // ── Puzzle & Oyun ─────────────────────────────────────────────────────
        new("Oyun & Eğitici", 0.93,
            "PUZZLE", "PAZIL", "YAPBOZ", "PAZEL",
            "OYUN HAMURU", "OYUNCAK",
            "ZEKA KÜPÜ", "ZEKA OYUNU",
            "MELODİKA", "MELODIKA",
            "LEGO", "KUTU OYUNU"),

        // ── Dosya / Klasör / Ofis ─────────────────────────────────────────────
        new("Ofis Malzemesi", 0.92,
            "DOSYA", "KLASÖR", "KLASOR",
            "ZİMBA", "ZIMBA", "ZİMBA TELİ",
            "DELGECİ", "DELGEC", "ATAÇ",
            "FİHRİST", "FİHRİST BÜYÜK", "FİHRİST KÜÇÜK"),

        // ── Yapıştırıcı & Bant ────────────────────────────────────────────────
        new("Yapıştırıcı & Bant", 0.92,
            "TUTKAL", "YAPIŞTIRICI", "YAPISTIRICI",
            "SELOTEYP", "BANT", "YAPISTIR",
            "UHU", "PRITT"),

        // ── Tebeşir ──────────────────────────────────────────────────────────
        new("Tebeşir", 0.95, "TEBEŞİR", "TEBESIR", "RENKLI TEBESIR", "RENKLİ TEBEŞİR"),

        // ── Resim / Sanat Seti ────────────────────────────────────────────────
        new("Resim Seti", 0.90,
            "RESİM SETİ", "RESIM SETI", "FIRÇA SETİ", "FIRCA SETI",
            "BOYA FIRÇASI", "BOYA FIRCASI"),

        // ── Bayrak & Aksesuar ─────────────────────────────────────────────────
        new("Aksesuar", 0.80,
            "ETİKET", "ETIKET", "STİKER", "STIKER",
            "BAYRAK", "ROZET"),
    };

    // Normalize: büyük harf + Türkçe karakter koru
    private static string Normalize(string input) =>
        input.Trim().ToUpperInvariant();

    /// <inheritdoc/>
    public CategorySuggestionDto? Suggest(string productName)
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
                    return new CategorySuggestionDto(
                        SuggestedCategoryName: rule.CategoryName,
                        ConfidenceScore: rule.Confidence,
                        MatchedKeyword: keyword,
                        SuggestedCategoryId: null); // DB lookup caller tarafından doldurulur
                }
            }
        }

        return null;
    }

    /// <inheritdoc/>
    public IReadOnlyList<(string ProductName, CategorySuggestionDto? Suggestion)> SuggestBulk(
        IEnumerable<string> productNames)
    {
        return productNames.Select(name => (name, Suggest(name))).ToList();
    }

    // ─── İç model ─────────────────────────────────────────────────────────────

    private sealed record CategoryRule(string CategoryName, double Confidence, params string[] Keywords);
}

// ─── Scoped Wrapper (DB erişimi için) ─────────────────────────────────────────

public interface IProductCategorizationDbService
{
    /// <summary>Ürün adı için kategori önerir; CategoryId DB'den doldurulur.</summary>
    Task<CategorySuggestionDto?> SuggestAsync(string productName, CancellationToken ct = default);

    /// <summary>Seçili (veya tüm) ürünler için önizleme üretir, değişiklik yapmaz.</summary>
    Task<BulkSuggestionResult> PreviewBulkAsync(IReadOnlyList<Guid>? productIds, bool onlyUncategorized, CancellationToken ct = default);

    /// <summary>Öneri motorunu çalıştırır ve eşleşen ürünleri günceller; kategoriler yoksa oluşturur.</summary>
    Task<BulkCategoryUpdateResult> ApplyBulkAsync(IReadOnlyList<Guid>? productIds, bool onlyUncategorized, CancellationToken ct = default);
}

/// <summary>
/// DB erişimi gerektiren, scoped wrapper. Kural motorunu <see cref="IProductCategorizationService"/> üzerinden kullanır,
/// kategori yoksa otomatik oluşturur.
/// </summary>
public sealed class ProductCategorizationDbService(
    IErpDbContext db,
    IProductCategorizationService engine) : IProductCategorizationDbService
{
    // "Genel" veya buna eşdeğer sayılan kategori isimleri
    private static readonly HashSet<string> GenelCategoryNames =
        new(StringComparer.OrdinalIgnoreCase) { "Genel", "GENEL", "General", "Uncategorized" };

    public async Task<CategorySuggestionDto?> SuggestAsync(string productName, CancellationToken ct = default)
    {
        var suggestion = engine.Suggest(productName);
        if (suggestion is null) return null;

        var categoryId = await ResolveCategoryIdAsync(suggestion.SuggestedCategoryName, ct);
        return suggestion with { SuggestedCategoryId = categoryId };
    }

    public async Task<BulkSuggestionResult> PreviewBulkAsync(
        IReadOnlyList<Guid>? productIds,
        bool onlyUncategorized,
        CancellationToken ct = default)
    {
        var products = await BuildProductQueryAsync(productIds, onlyUncategorized, ct);

        // DB'deki kategorileri bir kez çek (N+1 önleme)
        var existingCategories = await db.Categories
            .AsNoTracking()
            .ToDictionaryAsync(c => c.Name.Trim(), c => c.Id, StringComparer.OrdinalIgnoreCase, ct);

        var suggestions = new List<ProductSuggestionItem>(products.Count);

        foreach (var p in products)
        {
            var raw = engine.Suggest(p.Name);
            CategorySuggestionDto? withId = null;

            if (raw is not null)
            {
                existingCategories.TryGetValue(raw.SuggestedCategoryName, out var catId);
                withId = raw with { SuggestedCategoryId = catId == Guid.Empty ? null : catId };
            }

            suggestions.Add(new ProductSuggestionItem(
                p.Id, p.Code, p.Name,
                p.Category?.Name ?? "—",
                withId));
        }

        return new BulkSuggestionResult(
            TotalProducts: suggestions.Count,
            MatchedCount: suggestions.Count(s => s.Suggestion is not null),
            UnmatchedCount: suggestions.Count(s => s.Suggestion is null),
            Suggestions: suggestions);
    }

    public async Task<BulkCategoryUpdateResult> ApplyBulkAsync(
        IReadOnlyList<Guid>? productIds,
        bool onlyUncategorized,
        CancellationToken ct = default)
    {
        var products = await BuildProductQueryAsync(productIds, onlyUncategorized, ct);

        // Mevcut kategoriler (isim → Id haritası); yeni eklenenler de buraya eklenir
        var categoryCache = await db.Categories
            .ToDictionaryAsync(c => c.Name.Trim(), c => c, StringComparer.OrdinalIgnoreCase, ct);

        var createdCategoryNames = new List<string>();
        int updated = 0, skipped = 0, unmatched = 0;

        foreach (var product in products)
        {
            var raw = engine.Suggest(product.Name);
            if (raw is null)
            {
                unmatched++;
                continue;
            }

            var categoryName = raw.SuggestedCategoryName;

            // Kategori yoksa otomatik oluştur
            if (!categoryCache.TryGetValue(categoryName, out var category))
            {
                category = new Category
                {
                    Id = Guid.NewGuid(),
                    Name = categoryName,
                    ParentId = null
                };
                db.Categories.Add(category);
                categoryCache[categoryName] = category;
                createdCategoryNames.Add(categoryName);
            }

            // Zaten doğru kategorideyse atla
            if (product.CategoryId == category.Id)
            {
                skipped++;
                continue;
            }

            product.CategoryId = category.Id;
            updated++;
        }

        await db.SaveChangesAsync(ct);

        return new BulkCategoryUpdateResult(
            UpdatedCount: updated,
            SkippedCount: skipped,
            UnmatchedCount: unmatched,
            CreatedCategories: createdCategoryNames);
    }

    // ─── Yardımcı metodlar ────────────────────────────────────────────────────

    private async Task<List<Product>> BuildProductQueryAsync(
        IReadOnlyList<Guid>? productIds,
        bool onlyUncategorized,
        CancellationToken ct)
    {
        var query = db.Products.Include(p => p.Category).AsQueryable();

        if (productIds is { Count: > 0 })
            query = query.Where(p => productIds.Contains(p.Id));

        if (onlyUncategorized)
            query = query.Where(p =>
                p.Category == null ||
                GenelCategoryNames.Contains(p.Category.Name));

        return await query.ToListAsync(ct);
    }

    private async Task<Guid?> ResolveCategoryIdAsync(string categoryName, CancellationToken ct)
    {
        var cat = await db.Categories
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Name.ToLower() == categoryName.ToLower(), ct);
        return cat?.Id;
    }
}
