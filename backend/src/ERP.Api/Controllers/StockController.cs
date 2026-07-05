using ERP.Application.Dto;
using ERP.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ERP.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class StockController(IStockService stock) : ControllerBase
{
    [HttpGet("current")]
    public async Task<IActionResult> GetCurrent(
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromQuery] string? barcode,
        [FromQuery] string? productName,
        [FromQuery] string? warehouseName,
        CancellationToken cancellationToken)
    {
        if (page.HasValue && pageSize.HasValue)
        {
            var result = await stock.GetPagedCurrentAsync(page.Value, pageSize.Value, barcode, productName, warehouseName, cancellationToken);
            return Ok(result);
        }

        return Ok(await stock.GetCurrentAsync(cancellationToken));
    }

    [HttpGet("movements")]
    public async Task<IActionResult> GetMovements(
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromQuery] string? barcode,
        [FromQuery] string? productName,
        [FromQuery] string? warehouseName,
        [FromQuery] string? type,
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        if (page.HasValue && pageSize.HasValue)
        {
            var result = await stock.GetPagedMovementsAsync(page.Value, pageSize.Value, barcode, productName, warehouseName, type, status, cancellationToken);
            return Ok(result);
        }
        
        return Ok(await stock.GetMovementsAsync(cancellationToken));
    }

    [HttpPost("movements")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<ActionResult<StockMovementDto>> AddMovement(
        [FromBody] AddStockMovementRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await stock.AddMovementAsync(request, cancellationToken);
            return CreatedAtAction(nameof(GetMovements), result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("movements/{id:guid}/cancel")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> CancelMovement(
        Guid id,
        CancellationToken cancellationToken)
    {
        try
        {
            await stock.CancelMovementAsync(id, cancellationToken);
            return Ok();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}

