using ERP.Application.Abstractions;
using ERP.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace ERP.Api.Controllers;

[ApiController]
[Route("api/logs")]
[Authorize(Roles = "Admin")]
public class LogsController(IErpDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? level = null,
        [FromQuery] string? search = null,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 50;

        var query = dbContext.SystemLogs.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(level))
        {
            query = query.Where(x => x.Level == level);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(x => 
                (x.Message != null && x.Message.ToLower().Contains(searchLower)) ||
                (x.Exception != null && x.Exception.ToLower().Contains(searchLower)) ||
                (x.Properties != null && x.Properties.ToLower().Contains(searchLower))
            );
        }

        var totalCount = await query.CountAsync(ct);
        
        var items = await query
            .OrderByDescending(x => x.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        return Ok(new
        {
            items,
            totalCount,
            page,
            pageSize,
            totalPages
        });
    }

    [HttpPost("test")]
    public IActionResult CreateTestLog([FromQuery] string level = "Warning", [FromQuery] string message = "Bu bir test log mesajıdır.")
    {
        var logger = HttpContext.RequestServices.GetRequiredService<ILogger<LogsController>>();
        
        switch (level.ToLower())
        {
            case "warning":
                logger.LogWarning(message + " (Ek Detaylar: {TestProperty})", "TestDeğeri");
                break;
            case "error":
                logger.LogError(new Exception("Örnek Test Hatası (Stack Trace Testi)"), message);
                break;
            case "critical":
            case "fatal":
                logger.LogCritical(message);
                break;
            default:
                logger.LogWarning("Bilinmeyen log seviyesi ile test tetiklendi: {Message}", message);
                break;
        }

        return Ok(new { message = $"Test '{level}' logu tetiklendi." });
    }
}
