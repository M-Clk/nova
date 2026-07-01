using ERP.Application.Dto;
using ERP.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ERP.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SalesController(ISaleService sales) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<SaleDto>> Create(CreateSaleRequest request, CancellationToken cancellationToken)
    {
        var sale = await sales.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = sale.Id }, sale);
    }

    [HttpGet]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Get(
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromQuery] string? search,
        [FromQuery] string? dateFilter,
        [FromQuery] decimal? minAmount,
        [FromQuery] decimal? maxAmount,
        CancellationToken cancellationToken)
    {
        if (page.HasValue && pageSize.HasValue)
        {
            var result = await sales.GetPagedAsync(page.Value, pageSize.Value, search, dateFilter, minAmount, maxAmount, cancellationToken);
            return Ok(result);
        }
        
        return Ok(await sales.GetAsync(cancellationToken));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<ActionResult<SaleDto>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var sale = await sales.GetByIdAsync(id, cancellationToken);
        return sale is null ? NotFound() : Ok(sale);
    }
}
