using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ERP.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ERP.Infrastructure.Services;

public class LogCleanupBackgroundService(
    IServiceScopeFactory scopeFactory,
    ILogger<LogCleanupBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Geliştirme ortamında veya uygulamanın ilk açılışında temizliğin tetiklenmesi için küçük bir başlangıç gecikmesi.
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                logger.LogInformation("Sistem log temizleme arka plan görevi başlatılıyor...");

                using var scope = scopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<IErpDbContext>();

                var cutoffDate = DateTime.UtcNow.AddDays(-30);
                
                // EF Core 8 ExecuteDeleteAsync ile doğrudan DB üzerinde toplu silme işlemi.
                // Log tablosu çok büyük olabileceği için bu metot performansı olumsuz etkilemeden kayıtları tek adımda siler.
                var deletedCount = await dbContext.SystemLogs
                    .Where(x => x.Timestamp < cutoffDate)
                    .ExecuteDeleteAsync(stoppingToken);

                if (deletedCount > 0)
                {
                    logger.LogInformation("Sistem log temizliği tamamlandı: {Count} adet 30 günden eski log kaydı silindi.", deletedCount);
                }
                else
                {
                    logger.LogInformation("Sistem log temizliği tamamlandı: Silinecek eski log kaydı bulunamadı.");
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Sistem log temizleme işlemi sırasında hata oluştu.");
            }

            // Bir sonraki temizlik periyodu için 24 saat bekle.
            await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
        }
    }
}
