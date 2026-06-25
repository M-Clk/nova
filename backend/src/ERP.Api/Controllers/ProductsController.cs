using ERP.Application.Dto;
using ERP.Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace ERP.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProductsController(IProductService products, IPosService pos) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProductDto>>> Get(CancellationToken cancellationToken)
        => Ok(await products.GetAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProductDto>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var product = await products.GetByIdAsync(id, cancellationToken);
        return product is null ? NotFound() : Ok(product);
    }

    [HttpGet("barcode/{barcode}")]
    public async Task<ActionResult<PosProductDto>> GetByBarcode(string barcode, CancellationToken cancellationToken)
    {
        var product = await pos.GetProductByBarcodeAsync(barcode, cancellationToken);
        return product is null ? NotFound() : Ok(product);
    }

    [HttpPost]
    public async Task<ActionResult<ProductDto>> Create(CreateProductRequest request, CancellationToken cancellationToken)
    {
        var product = await products.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateProductRequest request, CancellationToken cancellationToken)
        => await products.UpdateAsync(id, request, cancellationToken) ? NoContent() : NotFound();

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
        => await products.DeleteAsync(id, cancellationToken) ? NoContent() : NotFound();
}

