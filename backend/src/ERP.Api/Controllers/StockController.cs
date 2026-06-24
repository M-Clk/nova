using ERP.Application.Dto;
using ERP.Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace ERP.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StockController(IStockService stock) : ControllerBase
{
    [HttpGet("current")]
    public async Task<ActionResult<IReadOnlyList<CurrentStockDto>>> GetCurrent(CancellationToken cancellationToken)
        => Ok(await stock.GetCurrentAsync(cancellationToken));

    [HttpGet("movements")]
    public async Task<ActionResult<IReadOnlyList<StockMovementDto>>> GetMovements(CancellationToken cancellationToken)
        => Ok(await stock.GetMovementsAsync(cancellationToken));
}
