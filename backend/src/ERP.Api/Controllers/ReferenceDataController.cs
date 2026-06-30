using ERP.Application.Dto;
using ERP.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ERP.Api.Controllers;

[ApiController]
[Route("api/reference-data")]
[Authorize]
public class ReferenceDataController(IReferenceDataService referenceData) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ReferenceDataDto>> Get(CancellationToken cancellationToken)
        => Ok(await referenceData.GetAsync(cancellationToken));

    [HttpPost("brands")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<ActionResult<LookupDto>> CreateBrand(CreateLookupRequest request, CancellationToken cancellationToken)
        => Ok(await referenceData.CreateBrandAsync(request, cancellationToken));

    [HttpPut("brands/{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> UpdateBrand(Guid id, UpdateLookupRequest request, CancellationToken cancellationToken)
        => await referenceData.UpdateBrandAsync(id, request, cancellationToken) ? NoContent() : NotFound();

    [HttpDelete("brands/{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> DeleteBrand(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            return await referenceData.DeleteBrandAsync(id, cancellationToken) ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("categories")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<ActionResult<LookupDto>> CreateCategory(CreateLookupRequest request, CancellationToken cancellationToken)
        => Ok(await referenceData.CreateCategoryAsync(request, cancellationToken));

    [HttpPut("categories/{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> UpdateCategory(Guid id, UpdateLookupRequest request, CancellationToken cancellationToken)
        => await referenceData.UpdateCategoryAsync(id, request, cancellationToken) ? NoContent() : NotFound();

    [HttpDelete("categories/{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> DeleteCategory(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            return await referenceData.DeleteCategoryAsync(id, cancellationToken) ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("units")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<ActionResult<LookupDto>> CreateUnit(CreateLookupRequest request, CancellationToken cancellationToken)
        => Ok(await referenceData.CreateUnitAsync(request, cancellationToken));

    [HttpPut("units/{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> UpdateUnit(Guid id, UpdateLookupRequest request, CancellationToken cancellationToken)
        => await referenceData.UpdateUnitAsync(id, request, cancellationToken) ? NoContent() : NotFound();

    [HttpDelete("units/{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> DeleteUnit(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            return await referenceData.DeleteUnitAsync(id, cancellationToken) ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("warehouses")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<ActionResult<LookupDto>> CreateWarehouse(CreateLookupRequest request, CancellationToken cancellationToken)
        => Ok(await referenceData.CreateWarehouseAsync(request, cancellationToken));
}
