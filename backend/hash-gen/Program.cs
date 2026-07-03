using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using BCrypt.Net;

namespace HashGen;

class Program
{
    static void Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;
        Console.WriteLine("=== Nova ERP Yardımcı Geliştirici Aracı ===");
        
        while (true)
        {
            Console.WriteLine("\nLütfen bir işlem seçin:");
            Console.WriteLine("1. Yeni RSA Key Pair (Lisanslama için Anahtar Çifti) Üret");
            Console.WriteLine("2. Lisans Anahtarı Üret (İmzala)");
            Console.WriteLine("3. Lisans Anahtarı Doğrula");
            Console.WriteLine("4. BCrypt Şifre Hash'i Üret (Kullanıcı Şifreleri için)");
            Console.WriteLine("0. Çıkış");
            Console.Write("Seçiminiz: ");
            
            var choice = Console.ReadLine();
            
            switch (choice)
            {
                case "1":
                    GenerateKeyPair();
                    break;
                case "2":
                    CreateLicense();
                    break;
                case "3":
                    VerifyLicense();
                    break;
                case "4":
                    GeneratePasswordHash();
                    break;
                case "0":
                    return;
                default:
                    Console.WriteLine("Geçersiz seçim. Tekrar deneyin.");
                    break;
            }
        }
    }

    static void GenerateKeyPair()
    {
        try
        {
            using var rsa = RSA.Create(2048);
            
            string privateKey = rsa.ExportPkcs8PrivateKeyPem();
            string publicKey = rsa.ExportSubjectPublicKeyInfoPem();
            
            Console.WriteLine("\n--- PRIVATE KEY (Gizli Tutun - Lisans Üretmek İçin) ---");
            Console.WriteLine(privateKey);
            
            Console.WriteLine("\n--- PUBLIC KEY (Uygulamaya Gömülecek) ---");
            Console.WriteLine(publicKey);
            
            // Dosyaya da yazalım kolaylık olsun
            File.WriteAllText("private_key.pem", privateKey);
            File.WriteAllText("public_key.pem", publicKey);
            Console.WriteLine("\n[BİLGİ] Anahtarlar private_key.pem ve public_key.pem dosyalarına kaydedildi.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Hata: {ex.Message}");
        }
    }

    static void CreateLicense()
    {
        try
        {
            Console.Write("\nMüşteri Adı: ");
            string customer = Console.ReadLine() ?? "Bilinmeyen Müşteri";
            
            Console.Write("Geçerlilik Süresi (Gün cinsinden, örn: 365): ");
            if (!int.TryParse(Console.ReadLine(), out int days)) days = 30;
            DateTime expirationDate = DateTime.UtcNow.AddDays(days);
            
            Console.Write("Maksimum Kullanıcı Sayısı (örn: 10): ");
            if (!int.TryParse(Console.ReadLine(), out int maxUsers)) maxUsers = 5;
            
            Console.WriteLine("İzin Verilen Özellikler (virgülle ayırın, örn: Satış,Stok,Raporlar veya hepsi için *): ");
            string featuresInput = Console.ReadLine() ?? "*";
            var features = new List<string>();
            foreach (var f in featuresInput.Split(','))
            {
                if (!string.IsNullOrWhiteSpace(f)) features.Add(f.Trim());
            }

            Console.WriteLine("\nPrivate Key (PEM formatı) girin veya private_key.pem dosyasından okumak için ENTER tuşuna basın:");
            string privateKeyPem = "";
            string inputKey = Console.ReadLine() ?? "";
            
            if (string.IsNullOrWhiteSpace(inputKey))
            {
                if (File.Exists("private_key.pem"))
                {
                    privateKeyPem = File.ReadAllText("private_key.pem");
                    Console.WriteLine("[BİLGİ] private_key.pem dosyasından okundu.");
                }
                else
                {
                    Console.WriteLine("[HATA] private_key.pem dosyası bulunamadı. Lütfen anahtarı manuel girin.");
                    return;
                }
            }
            else
            {
                // Manuel çok satırlı okuma
                var sb = new StringBuilder();
                sb.AppendLine(inputKey);
                string? line;
                while ((line = Console.ReadLine()) != null && line != "-----END PRIVATE KEY-----")
                {
                    sb.AppendLine(line);
                }
                sb.AppendLine("-----END PRIVATE KEY-----");
                privateKeyPem = sb.ToString();
            }

            // Lisans verisini hazırlayalım
            var licenseData = new
            {
                CustomerName = customer,
                ExpirationDate = expirationDate,
                MaxUsers = maxUsers,
                AllowedFeatures = features
            };

            string dataJson = JsonSerializer.Serialize(licenseData);
            byte[] dataBytes = Encoding.UTF8.GetBytes(dataJson);

            // İmzayı oluşturalım
            using var rsa = RSA.Create();
            rsa.ImportFromPem(privateKeyPem);
            
            byte[] signatureBytes = rsa.SignData(dataBytes, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            string signatureBase64 = Convert.ToBase64String(signatureBytes);

            // Lisans konteynerini hazırlayalım
            var licenseContainer = new
            {
                DataJson = Convert.ToBase64String(dataBytes), // JSON veriyi base64 yapalım ki taşınması kolay olsun
                Signature = signatureBase64
            };

            string containerJson = JsonSerializer.Serialize(licenseContainer);
            string licenseKey = Convert.ToBase64String(Encoding.UTF8.GetBytes(containerJson));

            Console.WriteLine("\n================ ÜRETİLEN LİSANS ANAHTARI ================");
            Console.WriteLine(licenseKey);
            Console.WriteLine("==========================================================");
            
            File.WriteAllText("license.lic", licenseKey);
            Console.WriteLine("\n[BİLGİ] Lisans anahtarı license.lic dosyasına kaydedildi.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Hata: {ex.Message}");
        }
    }

    static void VerifyLicense()
    {
        try
        {
            Console.WriteLine("\nDoğrulanacak Lisans Anahtarını girin veya license.lic dosyasından okumak için ENTER tuşuna basın:");
            string licenseKey = Console.ReadLine() ?? "";
            
            if (string.IsNullOrWhiteSpace(licenseKey))
            {
                if (File.Exists("license.lic"))
                {
                    licenseKey = File.ReadAllText("license.lic");
                    Console.WriteLine("[BİLGİ] license.lic dosyasından okundu.");
                }
                else
                {
                    Console.WriteLine("[HATA] license.lic dosyası bulunamadı.");
                    return;
                }
            }

            Console.WriteLine("\nPublic Key (PEM formatı) girin veya public_key.pem dosyasından okumak için ENTER tuşuna basın:");
            string publicKeyPem = "";
            string inputKey = Console.ReadLine() ?? "";
            
            if (string.IsNullOrWhiteSpace(inputKey))
            {
                if (File.Exists("public_key.pem"))
                {
                    publicKeyPem = File.ReadAllText("public_key.pem");
                    Console.WriteLine("[BİLGİ] public_key.pem dosyasından okundu.");
                }
                else
                {
                    Console.WriteLine("[HATA] public_key.pem dosyası bulunamadı.");
                    return;
                }
            }
            else
            {
                var sb = new StringBuilder();
                sb.AppendLine(inputKey);
                string? line;
                while ((line = Console.ReadLine()) != null && line != "-----END PUBLIC KEY-----")
                {
                    sb.AppendLine(line);
                }
                sb.AppendLine("-----END PUBLIC KEY-----");
                publicKeyPem = sb.ToString();
            }

            // Lisans anahtarını çözümleyelim
            byte[] containerBytes = Convert.FromBase64String(licenseKey.Trim());
            string containerJson = Encoding.UTF8.GetString(containerBytes);
            
            using var doc = JsonDocument.Parse(containerJson);
            string dataJsonBase64 = doc.RootElement.GetProperty("DataJson").GetString()!;
            string signatureBase64 = doc.RootElement.GetProperty("Signature").GetString()!;

            string dataJson = Encoding.UTF8.GetString(Convert.FromBase64String(dataJsonBase64));
            byte[] dataBytes = Encoding.UTF8.GetBytes(dataJson);
            byte[] signatureBytes = Convert.FromBase64String(signatureBase64);

            // RSA Doğrulama
            using var rsa = RSA.Create();
            rsa.ImportFromPem(publicKeyPem);
            
            bool isValid = rsa.VerifyData(dataBytes, signatureBytes, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);

            if (isValid)
            {
                Console.WriteLine("\n[✓] İMZA GEÇERLİ! Lisans verisi bozulmamış.");
                Console.WriteLine($"\nLisans İçeriği:\n{dataJson}");
                
                using var dataDoc = JsonDocument.Parse(dataJson);
                DateTime exp = dataDoc.RootElement.GetProperty("ExpirationDate").GetDateTime();
                if (exp < DateTime.UtcNow)
                {
                    Console.WriteLine($"[✗] LİSANS SÜRESİ DOLMUŞ! Bitiş Tarihi: {exp.ToLocalTime()}");
                }
                else
                {
                    Console.WriteLine($"[✓] Lisans Aktif. Son Kullanma Tarihi: {exp.ToLocalTime()}");
                }
            }
            else
            {
                Console.WriteLine("\n[✗] İMZA GEÇERSİZ! Lisans verisi manipüle edilmiş veya yanlış anahtar kullanılmış.");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Doğrulama hatası: {ex.Message}");
        }
    }

    static void GeneratePasswordHash()
    {
        Console.Write("\nŞifre girin: ");
        string password = Console.ReadLine() ?? "";
        if (string.IsNullOrEmpty(password))
        {
            Console.WriteLine("Şifre boş olamaz.");
            return;
        }
        string hash = BCrypt.Net.BCrypt.HashPassword(password, 11);
        Console.WriteLine($"Hash: {hash}");
    }
}
