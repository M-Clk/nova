using ERP.Application.Dto;
using ERP.Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace ERP.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PosController(IPosService pos) : ControllerBase
{
    [HttpGet("terminals")]
    public async Task<ActionResult<IReadOnlyList<TerminalDto>>> GetTerminals(CancellationToken cancellationToken)
        => Ok(await pos.GetTerminalsAsync(cancellationToken));

    [HttpPost("checkout")]
    public async Task<ActionResult<PosCheckoutResult>> Checkout(PosCheckoutRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await pos.CheckoutAsync(request, cancellationToken);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
