using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Net.Http.Json;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using ERP.Application.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ERP.Api.Controllers;

[ApiController]
[Route("api/system")]
public class SystemController(
    IConfiguration configuration,
    IErpDbContext dbContext,
    ILogger<SystemController> logger) : ControllerBase
{
    private static readonly HttpClient HttpClient = new() { Timeout = TimeSpan.FromSeconds(5) };

    private static readonly List<string> UpdateLogs = new();
    private static bool IsUpdateRunning = false;
    private static bool? IsUpdateSuccess = null;
    private static string? UpdateError = null;

    [HttpGet("info")]
    public async Task<IActionResult> GetSystemInfo()
    {
        var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "1.0.0";
        bool dbConnected = false;
        try
        {
            // Execute a lightweight query to verify connection
            _ = await dbContext.Brands.AnyAsync();
            dbConnected = true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to connect to database during health check");
        }

        return Ok(new
        {
            version,
            os = Environment.OSVersion.ToString(),
            runtime = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription,
            databaseConnected = dbConnected,
            serverTime = DateTime.UtcNow
        });
    }

    [HttpGet("check-update")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CheckForUpdates()
    {
        var currentVersionStr = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "1.0.0";
        var currentVersion = Version.TryParse(currentVersionStr, out var parsedCurrent) ? parsedCurrent : new Version(1, 0, 0);

        // Fallback update URL if not configured in appsettings
        var updateUrl = configuration["UpdateCheckUrl"]
                        ?? "https://raw.githubusercontent.com/M-Clk/nova/master/version.json";

        try
        {
            var updateManifest = await HttpClient.GetFromJsonAsync<UpdateManifest>(updateUrl);
            if (updateManifest == null || string.IsNullOrWhiteSpace(updateManifest.Version))
            {
                return Ok(new { updateAvailable = false, message = "Güncelleme bilgisi doğrulanamadı." });
            }

            if (Version.TryParse(updateManifest.Version, out var remoteVersion) && remoteVersion > currentVersion)
            {
                return Ok(new
                {
                    updateAvailable = true,
                    currentVersion = currentVersionStr,
                    latestVersion = updateManifest.Version,
                    releaseNotes = updateManifest.ReleaseNotes,
                    releaseDate = updateManifest.ReleaseDate,
                    message = $"Yeni sürüm mevcut ({updateManifest.Version}). Güncelleme önerilir."
                });
            }

            return Ok(new
            {
                updateAvailable = false,
                currentVersion = currentVersionStr,
                latestVersion = updateManifest.Version,
                message = "Uygulamanız güncel."
            });
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not fetch update manifest from {Url}", updateUrl);
            return Ok(new
            {
                updateAvailable = false,
                currentVersion = currentVersionStr,
                message = "Güncelleme sunucusuna erişilemedi. İnternet bağlantınızı kontrol edin."
            });
        }
    }

    [HttpGet("update-status")]
    [Authorize(Roles = "Admin")]
    public IActionResult GetUpdateStatus()
    {
        lock (UpdateLogs)
        {
            return Ok(new
            {
                isRunning = IsUpdateRunning,
                success = IsUpdateSuccess,
                error = UpdateError,
                logs = new List<string>(UpdateLogs)
            });
        }
    }

    [HttpPost("apply-update")]
    [Authorize(Roles = "Admin")]
    public IActionResult ApplyUpdate()
    {
        lock (UpdateLogs)
        {
            if (IsUpdateRunning)
            {
                return BadRequest(new { message = "Zaten aktif bir güncelleme işlemi çalışıyor." });
            }

            IsUpdateRunning = true;
            IsUpdateSuccess = null;
            UpdateError = null;
            UpdateLogs.Clear();
            UpdateLogs.Add("▶ Güncelleme işlemi arka planda başlatıldı...");
        }

        // 504 Gateway Timeout'u önlemek için işlemi arka plan iş parçacığına taşıyoruz
        _ = Task.Run(async () =>
        {
            try
            {
                // 1. Config'den yol okuma (öncelikli)
                var configScriptPath = configuration["Update:UpdateScriptPath"];
                var configComposePath = configuration["Update:ComposeFilePath"];

                // 2. Script varsa çalıştır (sadece uygun işletim sisteminde)
                string? scriptPath = null;
                if (!string.IsNullOrWhiteSpace(configScriptPath) && System.IO.File.Exists(configScriptPath))
                {
                    var isWindows = RuntimeInformation.IsOSPlatform(OSPlatform.Windows);
                    var isPs1 = configScriptPath.EndsWith(".ps1", StringComparison.OrdinalIgnoreCase);
                    if (isWindows || !isPs1)
                    {
                        scriptPath = configScriptPath;
                        lock (UpdateLogs) UpdateLogs.Add($"▶ Yapılandırılmış güncelleme betiği kullanılıyor: {scriptPath}");
                    }
                    else
                    {
                        lock (UpdateLogs) UpdateLogs.Add("⚠ Linux container icinde .ps1 betigi calistirilamaz. Docker Compose entegrasyonu kullanilacak.");
                    }
                }
                else
                {
                    // Fallback: sadece Windows host üzerinde çalışıyorsak yerel .ps1 aranabilir
                    if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                    {
                        var appBase = AppContext.BaseDirectory;
                        var scriptsDir = FindScriptsDirectory(appBase);
                        if (scriptsDir != null)
                        {
                            var candidate = Path.Combine(scriptsDir, "update-nova.ps1");
                            if (System.IO.File.Exists(candidate))
                            {
                                scriptPath = candidate;
                                lock (UpdateLogs) UpdateLogs.Add($"▶ Güncelleme betiği bulundu: {scriptPath}");
                            }
                        }
                    }
                }

                if (scriptPath != null)
                {
                    var scriptLogs = new List<string>();
                    var (exitCode, _) = await RunProcessAsync(
                        RuntimeInformation.IsOSPlatform(OSPlatform.Windows) ? "powershell" : "pwsh",
                        $"-ExecutionPolicy Bypass -File \"{scriptPath}\"",
                        scriptLogs);

                    lock (UpdateLogs)
                    {
                        UpdateLogs.AddRange(scriptLogs);
                    }

                    if (exitCode != 0)
                    {
                        lock (UpdateLogs)
                        {
                            IsUpdateRunning = false;
                            IsUpdateSuccess = false;
                            UpdateError = "Güncelleme betiği hata ile sonlandı.";
                        }
                        return;
                    }

                    lock (UpdateLogs)
                    {
                        UpdateLogs.Add("✅ Güncelleme başarıyla tamamlandı!");
                        IsUpdateRunning = false;
                        IsUpdateSuccess = true;
                    }
                    return;
                }

                // 3. Compose dosyası ile docker compose komutu
                string? composeFile = null;
                if (!string.IsNullOrWhiteSpace(configComposePath) && System.IO.File.Exists(configComposePath))
                {
                    composeFile = configComposePath;
                    lock (UpdateLogs) UpdateLogs.Add($"▶ Yapılandırılmış Compose dosyası kullanılıyor: {Path.GetFileName(composeFile)}");
                }
                else
                {
                    // Fallback: dizin taraması
                    composeFile = FindComposeFile(AppContext.BaseDirectory);
                    if (composeFile != null)
                        lock (UpdateLogs) UpdateLogs.Add($"▶ Docker Compose dosyası bulundu: {Path.GetFileName(composeFile)}");
                }

                if (composeFile == null)
                {
                    lock (UpdateLogs)
                    {
                        UpdateLogs.Add("⚠ docker-compose.yml bulunamadı.");
                        UpdateLogs.Add("  → Çözüm: docker-compose ortamında aşağıdaki environment variable'ı tanımlayın:");
                        UpdateLogs.Add("    Update__ComposeFilePath=/host/path/to/docker-compose.prod.yml");
                        IsUpdateRunning = false;
                        IsUpdateSuccess = false;
                        UpdateError = "Compose dosyası bulunamadı.";
                    }
                    return;
                }

                // 4. Güncelleme öncesi otomatik DB Yedekleme adımı
                var backupLogs = new List<string>();
                await BackupDatabaseAsync(backupLogs);
                lock (UpdateLogs)
                {
                    UpdateLogs.AddRange(backupLogs);
                }

                var projectName = configuration["Update:ProjectName"] ?? "nova";

                lock (UpdateLogs) UpdateLogs.Add("[1/2] Güncel Docker imajları indiriliyor...");
                var pullLogs = new List<string>();
                var (pullCode, _) = await RunProcessAsync("docker", $"compose -f \"{composeFile}\" -p {projectName} pull", pullLogs);
                lock (UpdateLogs)
                {
                    UpdateLogs.AddRange(pullLogs);
                }

                if (pullCode != 0)
                {
                    lock (UpdateLogs)
                    {
                        IsUpdateRunning = false;
                        IsUpdateSuccess = false;
                        UpdateError = "docker compose pull başarısız.";
                    }
                    return;
                }

                lock (UpdateLogs) UpdateLogs.Add("[2/2] Konteynerler güncelleniyor...");
                var upLogs = new List<string>();
                var (upCode, _) = await RunProcessAsync("docker", $"compose -f \"{composeFile}\" -p {projectName} up -d --remove-orphans", upLogs);
                lock (UpdateLogs)
                {
                    UpdateLogs.AddRange(upLogs);
                }

                if (upCode != 0)
                {
                    lock (UpdateLogs)
                    {
                        IsUpdateRunning = false;
                        IsUpdateSuccess = false;
                        UpdateError = "docker compose up başarısız.";
                    }
                    return;
                }

                lock (UpdateLogs)
                {
                    UpdateLogs.Add("✅ Güncelleme başarıyla tamamlandı!");
                    IsUpdateRunning = false;
                    IsUpdateSuccess = true;
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Background update failed");
                lock (UpdateLogs)
                {
                    IsUpdateRunning = false;
                    IsUpdateSuccess = false;
                    UpdateError = ex.Message;
                    UpdateLogs.Add($"❌ Hata: {ex.Message}");
                }
            }
        });

        return Ok(new { success = true, message = "Güncelleme arka planda başlatıldı." });
    }

    private async Task BackupDatabaseAsync(List<string> logs)
    {
        try
        {
            logs.Add("[Yedekleme] Veri tabanı yedekleme işlemi başlatılıyor...");
            var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
            var backupFile = $"novadb_backup_{timestamp}.dump";
            var tempContainerPath = $"/tmp/{backupFile}";

            // 1. pg_dump
            logs.Add($"[Yedekleme] Container içinde dump dosyası oluşturuluyor (nova-db-1)...");
            var (exitCode, _) = await RunProcessAsync("docker", $"exec nova-db-1 pg_dump -U nova -d novadb -F c -f {tempContainerPath}", logs);
            if (exitCode != 0)
            {
                logs.Add("⚠ Veri tabanı yedeği alınamadı! Güncelleme işlemine güvenlik nedeniyle devam ediliyor.");
                return;
            }

            // 2. host klasörüne kopyalama
            var hostDir = "/host";
            if (Directory.Exists(hostDir))
            {
                var backupsDir = Path.Combine(hostDir, "backups");
                if (!Directory.Exists(backupsDir))
                {
                    Directory.CreateDirectory(backupsDir);
                }

                var targetPath = Path.Combine(backupsDir, backupFile);
                logs.Add($"[Yedekleme] Yedek dosyası host sistemine kopyalanıyor: {targetPath}");
                var (cpCode, _) = await RunProcessAsync("docker", $"cp nova-db-1:{tempContainerPath} {targetPath}", logs);
                if (cpCode == 0)
                {
                    logs.Add($"✅ Veri tabanı yedeği başarıyla alındı: C:\\Nova\\backups\\{backupFile}");
                }
                else
                {
                    logs.Add("⚠ Yedek dosyası host sistemine aktarılamadı! Güncellemeye yedeksiz devam ediliyor.");
                }
            }
            else
            {
                logs.Add("⚠ /host dizini bulunamadı, yedek dosyası dışa aktarılamadı. Güncellemeye yedeksiz devam ediliyor.");
            }

            // 3. /tmp temizliği
            await RunProcessAsync("docker", $"exec nova-db-1 rm {tempContainerPath}", new List<string>());
        }
        catch (Exception ex)
        {
            logs.Add($"⚠ Yedekleme adımı başarısız oldu: {ex.Message}. Güncellemeye devam ediliyor.");
        }
    }

    private static string? FindScriptsDirectory(string startDir)
    {
        var dir = startDir;
        for (var i = 0; i < 8; i++)
        {
            var candidate = Path.Combine(dir, "scripts");
            if (Directory.Exists(candidate)) return candidate;
            var parent = Directory.GetParent(dir)?.FullName;
            if (parent == null) break;
            dir = parent;
        }
        return null;
    }

    private static string? FindComposeFile(string startDir)
    {
        var dir = startDir;
        for (var i = 0; i < 8; i++)
        {
            foreach (var name in new[] { "docker-compose.prod.yml", "docker-compose.windows.yml", "docker-compose.yml" })
            {
                var candidate = Path.Combine(dir, name);
                if (System.IO.File.Exists(candidate)) return candidate;
            }
            var parent = Directory.GetParent(dir)?.FullName;
            if (parent == null) break;
            dir = parent;
        }
        return null;
    }

    private static async Task<(int ExitCode, string Output)> RunProcessAsync(
        string fileName, string arguments, List<string> logs)
    {
        using var process = new Process();
        process.StartInfo = new ProcessStartInfo
        {
            FileName = fileName,
            Arguments = arguments,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        process.Start();

        var outputTask = process.StandardOutput.ReadToEndAsync();
        var errorTask = process.StandardError.ReadToEndAsync();

        await process.WaitForExitAsync();

        var output = await outputTask;
        var error = await errorTask;

        if (!string.IsNullOrWhiteSpace(output))
            foreach (var line in output.Split('\n', StringSplitOptions.RemoveEmptyEntries))
                logs.Add(line.TrimEnd());

        if (!string.IsNullOrWhiteSpace(error))
            foreach (var line in error.Split('\n', StringSplitOptions.RemoveEmptyEntries))
                logs.Add($"⚠ {line.TrimEnd()}");

        return (process.ExitCode, output);
    }
}

public class UpdateManifest
{
    public string Version { get; set; } = string.Empty;
    public string ReleaseNotes { get; set; } = string.Empty;
    public string ReleaseDate { get; set; } = string.Empty;
}
