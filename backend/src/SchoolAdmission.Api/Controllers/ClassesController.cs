using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Api.Errors;
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

    [HttpPatch("{classId}")]
    [ProducesResponseType(typeof(ClassSummaryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ClassSummaryResponse>> Update(
        string classId,
        [FromBody] UpdateClassRequest? request,
        CancellationToken cancellationToken)
    {
        var result = await classManagementService.UpdateAsync(classId, request, cancellationToken);

        if (!result.IsSuccess)
        {
            return ToProblem(result.Error!);
        }

        return Ok(result.Value);
    }

    private ObjectResult ToProblem(ClassManagementError error) => error.Code switch
    {
        ClassManagementErrorCode.ValidationError => ApiProblemDetails.Create(
            HttpContext,
            StatusCodes.Status400BadRequest,
            "VALIDATION_ERROR",
            "Validation failed",
            "validation-error",
            error.Detail,
            error.Errors),
        ClassManagementErrorCode.ClassNotFound => ApiProblemDetails.Create(
            HttpContext,
            StatusCodes.Status404NotFound,
            "CLASS_NOT_FOUND",
            "Class not found",
            "class-not-found",
            error.Detail,
            error.Errors),
        ClassManagementErrorCode.CapacityCannotDecrease => ApiProblemDetails.Create(
            HttpContext,
            StatusCodes.Status409Conflict,
            "CAPACITY_CANNOT_DECREASE",
            "Capacity cannot be decreased",
            "capacity-cannot-decrease",
            error.Detail,
            error.Errors),
        _ => ApiProblemDetails.Create(
            HttpContext,
            StatusCodes.Status500InternalServerError,
            "INTERNAL_ERROR",
            "Unexpected error",
            "internal-error",
            "The request could not be completed.")
    };
}
