using ERP.Application.Dto;
using ERP.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ERP.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProductsController(IProductService products, IPosService pos) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromQuery] string? search,
        [FromQuery] Guid? brandId,
        [FromQuery] Guid? categoryId,
        [FromQuery] bool? isActive,
        CancellationToken cancellationToken)
    {
        if (page.HasValue && pageSize.HasValue)
        {
            var result = await products.GetPagedAsync(page.Value, pageSize.Value, search, brandId, categoryId, isActive, cancellationToken);
            return Ok(result);
        }
        
        return Ok(await products.GetAsync(cancellationToken));
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export(
        [FromQuery] string? search = null,
        [FromQuery] Guid? brandId = null,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] bool? isActive = null,
        CancellationToken cancellationToken = default)
    {
        var result = await products.ExportProductsAsync(search, brandId, categoryId, isActive, cancellationToken);
        return File(result.Content, result.ContentType, result.FileName);
    }

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
    [Authorize(Roles = "Admin,Manager")]
    public async Task<ActionResult<ProductDto>> Create(CreateProductRequest request, CancellationToken cancellationToken)
    {
        var product = await products.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Update(Guid id, UpdateProductRequest request, CancellationToken cancellationToken)
        => await products.UpdateAsync(id, request, cancellationToken) ? NoContent() : NotFound();

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
        => await products.DeleteAsync(id, cancellationToken) ? NoContent() : NotFound();

    [HttpPost("bulk-price-update")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> BulkPriceUpdate(
        [FromBody] BulkPriceUpdateRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Items.Count == 0)
            return BadRequest(new { error = "En az bir ürün gereklidir." });

        if (request.Items.Count > 500)
            return BadRequest(new { error = "Tek seferde en fazla 500 ürün güncellenebilir." });

        var changedBy = User.FindFirstValue(ClaimTypes.Name) ?? "unknown";

        try
        {
            var result = await products.BulkUpdatePricesAsync(request, changedBy, cancellationToken);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("bulk-price-update/{batchId:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> RevertBulkPriceUpdate(Guid batchId, CancellationToken cancellationToken)
    {
        var revertedBy = User.FindFirstValue(ClaimTypes.Name) ?? "unknown";

        try
        {
            var count = await products.RevertBulkPriceUpdateAsync(batchId, revertedBy, cancellationToken);
            return Ok(new { revertedCount = count });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("price-history")]
    public async Task<IActionResult> GetPriceHistory(
        [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default)
    {
        var history = await products.GetRecentPriceHistoryAsync(limit, cancellationToken);
        return Ok(history);
    }

    [HttpPost("import-prices")]
    [Authorize(Roles = "Admin,Manager")]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10 MB
    public async Task<IActionResult> ImportPrices(
        IFormFile file,
        CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "Dosya seçilmedi veya boş." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".xlsx")
            return BadRequest(new { error = "Yalnızca Excel (.xlsx) dosyası yüklenebilir." });

        var changedBy = User.FindFirstValue(ClaimTypes.Name) ?? "unknown";

        try
        {
            using var stream = file.OpenReadStream();
            var result = await products.ImportPricesFromExcelAsync(stream, changedBy, cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}

