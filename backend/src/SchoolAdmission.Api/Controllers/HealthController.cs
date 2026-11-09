using Microsoft.AspNetCore.Mvc;

namespace SchoolAdmission.Api.Controllers;

[ApiController]
[Route("health")]
public sealed class HealthController : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public ActionResult<HealthResponse> Get()
    {
        return Ok(new HealthResponse("Healthy"));
    }

    public sealed record HealthResponse(string Status);
}
