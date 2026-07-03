using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using ERP.Application.Abstractions;
using ERP.Application.Common.License;
using ERP.Application.Services;
using ERP.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ERP.Infrastructure.Services;

public class LicenseService : ILicenseService
{
    private readonly IServiceScopeFactory _scopeFactory;
    
    // Gömülü Public Key - İmzaları doğrulamak için kullanılır
    private const string PublicKeyPem = @"-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxF5lME9f2MXuaNONukkQ
HCeabdDZ/nnCpz9kJwtiD5XlaiUaLk72ukaL4RaA5TgPWjYmQWBiR0AKzdUU3i6E
mYxbl7wuiuZeDfGJ415UnMdPL1CE8ntKSCFPzQeIXhPOptXMac6ykEJTcChP17zz
ic50/mvv0ebh9IzfeJbNs/t0yIHqedWGDnswbqO/RyOCHE9J1NwUALjSzrf8Iogn
4c+l8OJqntlsCe0lS8LT/C9VU00dKLAswda5wedaQsY5HUGX9dsTYWd0tkoF+kWv
ZJnpjXbcRYvpACh5oDsMUWuJeyrgsTR0sgDxVFcnaDvZm43Nx0UMu61Z7rYFQzNC
RQIDAQAB
-----END PUBLIC KEY-----";

    // Lisans durumunu bellekte cache'leyelim (1 dakika boyunca DB'ye gitmesin)
    private (DateTime CachedAt, bool IsValid, LicenseInfo? Info, string Message)? _cache;
    private readonly object _cacheLock = new();
    private const int CacheDurationSeconds = 60;

    public LicenseService(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    public async Task<(bool IsValid, LicenseInfo? Info, string Message)> CheckLicenseAsync()
    {
        lock (_cacheLock)
        {
            if (_cache.HasValue && (DateTime.UtcNow - _cache.Value.CachedAt).TotalSeconds < CacheDurationSeconds)
            {
                return (_cache.Value.IsValid, _cache.Value.Info, _cache.Value.Message);
            }
        }

        var result = await LoadAndVerifyLicenseFromDbAsync();

        lock (_cacheLock)
        {
            _cache = (DateTime.UtcNow, result.IsValid, result.Info, result.Message);
        }

        return result;
    }

    public async Task<bool> ActivateLicenseAsync(string licenseKey)
    {
        if (string.IsNullOrWhiteSpace(licenseKey))
        {
            return false;
        }

        // Önce lisansı doğrulayalım
        var (isValid, _, _) = VerifyLicenseKey(licenseKey);
        if (!isValid)
        {
            return false;
        }

        // Veritabanına kaydedelim
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IErpDbContext>();

        var setting = await db.SystemSettings.FirstOrDefaultAsync(s => s.Key == "LicenseKey");
        if (setting == null)
        {
            setting = new SystemSetting
            {
                Id = Guid.NewGuid(),
                Key = "LicenseKey",
                Value = licenseKey.Trim()
            };
            db.SystemSettings.Add(setting);
        }
        else
        {
            setting.Value = licenseKey.Trim();
        }

        await db.SaveChangesAsync();

        // Cache'i temizleyelim ki bir sonraki kontrolde yeni lisans geçerli olsun
        lock (_cacheLock)
        {
            _cache = null;
        }

        return true;
    }

    private async Task<(bool IsValid, LicenseInfo? Info, string Message)> LoadAndVerifyLicenseFromDbAsync()
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<IErpDbContext>();

            var setting = await db.SystemSettings.FirstOrDefaultAsync(s => s.Key == "LicenseKey");
            if (setting == null || string.IsNullOrWhiteSpace(setting.Value))
            {
                return (false, null, "Sistem lisanslı değil. Lütfen geçerli bir lisans anahtarı yükleyin.");
            }

            return VerifyLicenseKey(setting.Value);
        }
        catch (Exception ex)
        {
            return (false, null, $"Lisans kontrolü sırasında hata oluştu: {ex.Message}");
        }
    }

    private (bool IsValid, LicenseInfo? Info, string Message) VerifyLicenseKey(string licenseKey)
    {
        try
        {
            // Lisans anahtarı base64 ile kodlanmış bir konteyner JSON'dur
            byte[] containerBytes = Convert.FromBase64String(licenseKey.Trim());
            string containerJson = Encoding.UTF8.GetString(containerBytes);

            var container = JsonSerializer.Deserialize<LicenseContainer>(containerJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (container == null || string.IsNullOrWhiteSpace(container.DataJson) || string.IsNullOrWhiteSpace(container.Signature))
            {
                return (false, null, "Lisans anahtarı yapısı geçersiz.");
            }

            // DataJson ve Signature'ı çözümle
            string dataJson = Encoding.UTF8.GetString(Convert.FromBase64String(container.DataJson));
            byte[] dataBytes = Encoding.UTF8.GetBytes(dataJson);
            byte[] signatureBytes = Convert.FromBase64String(container.Signature);

            // RSA ile doğrula
            using var rsa = RSA.Create();
            rsa.ImportFromPem(PublicKeyPem);

            bool isSignatureValid = rsa.VerifyData(dataBytes, signatureBytes, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            if (!isSignatureValid)
            {
                return (false, null, "Lisans imzası doğrulanmadı. Lisans dosyası değiştirilmiş olabilir.");
            }

            // Veriyi nesneye dönüştür
            var info = JsonSerializer.Deserialize<LicenseInfo>(dataJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (info == null)
            {
                return (false, null, "Lisans içeriği çözümlenemedi.");
            }

            // Süre kontrolü
            if (info.ExpirationDate < DateTime.UtcNow)
            {
                return (false, info, $"Lisansın süresi {info.ExpirationDate.ToLocalTime()} tarihinde dolmuş.");
            }

            return (true, info, "Lisans geçerli.");
        }
        catch (Exception)
        {
            return (false, null, "Lisans anahtarı doğrulanamadı.");
        }
    }
}
