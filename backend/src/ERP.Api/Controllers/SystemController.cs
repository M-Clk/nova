using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Reflection;
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

    [HttpGet("info")]
    public async Task<IActionResult> GetSystemInfo()
    {
        var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "1.0.0";
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
        var currentVersionStr = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "1.0.0";
        var currentVersion = Version.TryParse(currentVersionStr, out var parsedCurrent) ? parsedCurrent : new Version(1, 0, 0);

        // Fallback update URL if not configured in appsettings
        var updateUrl = configuration["UpdateCheckUrl"] 
                        ?? "https://raw.githubusercontent.com/mclk2148/nova-releases/main/version.json";

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
}

public class UpdateManifest
{
    public string Version { get; set; } = string.Empty;
    public string ReleaseNotes { get; set; } = string.Empty;
    public string ReleaseDate { get; set; } = string.Empty;
}
