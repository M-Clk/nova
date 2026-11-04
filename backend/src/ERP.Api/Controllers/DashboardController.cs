using ERP.Application.Dto;
using ERP.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ERP.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController(IDashboardService dashboardService) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryDto>> GetSummary(
        [FromQuery] int period = 7,
        CancellationToken cancellationToken = default)
    {
        var isPrivileged = User.IsInRole("Admin") || User.IsInRole("Manager");
        var summary = await dashboardService.GetSummaryAsync(period, isPrivileged, cancellationToken);
        return Ok(summary);
    }
}

