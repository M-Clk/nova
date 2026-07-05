using ERP.Application.Dto;
using ERP.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ERP.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Manager")]
public class ReportsController(IStockReportService stockReport) : ControllerBase
{
    // ─── Stok Raporları ──────────────────────────────────────────────────────

    [HttpGet("stock/summary")]
    public async Task<ActionResult<StockSummaryReportDto>> GetStockSummary(CancellationToken cancellationToken)
        => Ok(await stockReport.GetSummaryAsync(cancellationToken));

    [HttpGet("stock/movements")]
    public async Task<ActionResult<StockMovementReportDto>> GetStockMovementReport(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] Guid? warehouseId,
        [FromQuery] Guid? productId,
        [FromQuery] int? type,
        CancellationToken cancellationToken)
        => Ok(await stockReport.GetMovementReportAsync(startDate, endDate, warehouseId, productId, type, cancellationToken));

    [HttpGet("stock/low-stock")]
    public async Task<ActionResult<LowStockReportDto>> GetLowStock(CancellationToken cancellationToken)
        => Ok(await stockReport.GetLowStockAsync(cancellationToken));

    [HttpGet("stock/movements/export")]
    public async Task<IActionResult> ExportStockMovements(
        [FromQuery] string format = "csv",
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] Guid? warehouseId = null,
        [FromQuery] Guid? productId = null,
        [FromQuery] int? type = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await stockReport.ExportMovementsAsync(format, startDate, endDate, warehouseId, productId, type, cancellationToken);
            return File(result.Content, result.ContentType, result.FileName);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
