namespace ERP.Application.Services;

/// <summary>
/// Export sonucu — format-agnostic dosya çıktısı.
/// ContentType ve FileExtension, hangi exporter kullanıldığına göre belirlenir.
/// </summary>
public record ExportResult(byte[] Content, string ContentType, string FileName);

/// <summary>
/// Rapor export stratejisi — CSV, PDF vb. formatlar bu interface'i implement eder.
/// Yeni format eklemek için:
///   1. Bu interface'i implement eden yeni bir sınıf oluşturun (ör. PdfReportExporter)
///   2. DependencyInjection.cs'de Format key'i ile kayıt edin
///   3. Controller'da format parametresiyle çözümleyin
/// </summary>
public interface IReportExporter
{
    /// <summary>
    /// Desteklenen format adı (ör. "csv", "pdf")
    /// </summary>
    string Format { get; }

    /// <summary>
    /// Dosya uzantısı (ör. ".csv", ".pdf")
    /// </summary>
    string FileExtension { get; }

    /// <summary>
    /// HTTP Content-Type (ör. "text/csv", "application/pdf")
    /// </summary>
    string ContentType { get; }

    /// <summary>
    /// Sütun başlıkları ve satır verilerinden dosya içeriği oluşturur.
    /// </summary>
    byte[] Export(string[] headers, IEnumerable<string[]> rows);
}

/// <summary>
/// Kayıtlı exporter'ları format adıyla çözer.
/// </summary>
public interface IReportExporterFactory
{
    IReportExporter GetExporter(string format);
    IReadOnlyList<string> SupportedFormats { get; }
}

/// <summary>
/// CSV exporter — varsayılan export formatı.
/// </summary>
public class CsvReportExporter : IReportExporter
{
    public string Format => "csv";
    public string FileExtension => ".csv";
    public string ContentType => "text/csv";

    public byte[] Export(string[] headers, IEnumerable<string[]> rows)
    {
        using var ms = new MemoryStream();
        using var writer = new StreamWriter(ms, new System.Text.UTF8Encoding(true));

        // BOM for Excel UTF-8 compatibility
        writer.WriteLine(string.Join(";", headers));

        foreach (var row in rows)
        {
            var escapedRow = row.Select(field =>
            {
                if (field.Contains(';') || field.Contains('"') || field.Contains('\n'))
                    return $"\"{field.Replace("\"", "\"\"")}\"";
                return field;
            });
            writer.WriteLine(string.Join(";", escapedRow));
        }

        writer.Flush();
        return ms.ToArray();
    }
}

/// <summary>
/// Exporter factory — DI'dan aldığı tüm IReportExporter implementasyonlarını yönetir.
/// Yeni bir exporter eklediğinizde otomatik olarak keşfedilir.
/// </summary>
public class ReportExporterFactory : IReportExporterFactory
{
    private readonly Dictionary<string, IReportExporter> _exporters;

    public ReportExporterFactory(IEnumerable<IReportExporter> exporters)
    {
        _exporters = exporters.ToDictionary(e => e.Format, StringComparer.OrdinalIgnoreCase);
    }

    public IReportExporter GetExporter(string format)
    {
        if (_exporters.TryGetValue(format, out var exporter))
            return exporter;

        throw new InvalidOperationException(
            $"Unsupported export format: '{format}'. Supported formats: {string.Join(", ", _exporters.Keys)}");
    }

    public IReadOnlyList<string> SupportedFormats => _exporters.Keys.ToList();
}
