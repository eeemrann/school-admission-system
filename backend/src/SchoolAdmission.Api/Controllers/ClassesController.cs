using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Application.Classes;

namespace SchoolAdmission.Api.Controllers;

[ApiController]
[Route("classes")]
public sealed class ClassesController(IClassManagementService classManagementService) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(CreatedClassResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CreatedClassResponse>> Create(
        [FromBody] CreateClassRequest? request,
        CancellationToken cancellationToken)
    {
        var result = await classManagementService.CreateAsync(request, cancellationToken);

        if (!result.IsSuccess)
        {
            return ToProblem(result.Error!);
        }

        return CreatedAtAction(
            nameof(GetById),
            new { classId = result.Value!.Id },
            result.Value);
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ClassSummaryResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ClassSummaryResponse>>> List(
        CancellationToken cancellationToken)
    {
        return Ok(await classManagementService.ListAsync(cancellationToken));
    }

    [HttpGet("{classId}")]
    [ProducesResponseType(typeof(ClassSummaryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ClassSummaryResponse>> GetById(
        string classId,
        CancellationToken cancellationToken)
    {
        var result = await classManagementService.GetByIdAsync(classId, cancellationToken);

        if (!result.IsSuccess)
        {
            return ToProblem(result.Error!);
        }

        return Ok(result.Value);
    }

    private ObjectResult ToProblem(ClassManagementError error)
    {
        var (status, title, type, code) = error.Code switch
        {
            ClassManagementErrorCode.ValidationError =>
                (StatusCodes.Status400BadRequest, "Validation failed", "validation-error", "VALIDATION_ERROR"),
            ClassManagementErrorCode.ClassNotFound =>
                (StatusCodes.Status404NotFound, "Class not found", "class-not-found", "CLASS_NOT_FOUND"),
            _ =>
                (StatusCodes.Status500InternalServerError, "Unexpected error", "internal-error", "INTERNAL_ERROR")
        };

        var problem = new ProblemDetails
        {
            Type = $"https://example.invalid/problems/{type}",
            Title = title,
            Status = status,
            Detail = error.Detail,
            Instance = HttpContext.Request.Path
        };
        problem.Extensions["code"] = code;

        if (error.Errors is not null)
        {
            problem.Extensions["errors"] = error.Errors;
        }

        return new ObjectResult(problem)
        {
            StatusCode = status,
            ContentTypes = ["application/problem+json"]
        };
    }
}
