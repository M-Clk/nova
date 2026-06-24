using ERP.Application.Dto;
using ERP.Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace ERP.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SalesController(ISaleService sales) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<SaleDto>> Create(CreateSaleRequest request, CancellationToken cancellationToken)
    {
        var sale = await sales.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = sale.Id }, sale);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SaleDto>>> Get(CancellationToken cancellationToken)
        => Ok(await sales.GetAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SaleDto>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var sale = await sales.GetByIdAsync(id, cancellationToken);
        return sale is null ? NotFound() : Ok(sale);
    }
}
