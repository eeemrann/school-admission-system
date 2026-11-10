using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Api.Errors;
using SchoolAdmission.Application.Reservations;

namespace SchoolAdmission.Api.Controllers;

[ApiController]
public sealed class HoldsController(IHoldReservationService holdReservationService) : ControllerBase
{
    [HttpPost("/classes/{classId}/holds")]
    [ProducesResponseType(typeof(HoldResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<HoldResponse>> Create(
        string classId,
        [FromHeader(Name = "X-Student-Id")] string? studentId,
        CancellationToken cancellationToken)
    {
        var result = await holdReservationService.CreateAsync(classId, studentId, cancellationToken);

        if (!result.IsSuccess)
        {
            return ToProblem(result.Error!);
        }

        return Created($"/holds/{result.Value!.HoldId}", result.Value);
    }

    [HttpGet("/holds/{holdId}")]
    [ProducesResponseType(typeof(HoldDetailsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<HoldDetailsResponse>> GetById(
        string holdId,
        CancellationToken cancellationToken)
    {
        var result = await holdReservationService.GetByIdAsync(holdId, cancellationToken);

        if (!result.IsSuccess)
        {
            return ToProblem(result.Error!);
        }

        return Ok(result.Value);
    }

    private ObjectResult ToProblem(HoldManagementError error) => error.Code switch
    {
        HoldManagementErrorCode.ValidationError => ApiProblemDetails.Create(
            HttpContext,
            StatusCodes.Status400BadRequest,
            "VALIDATION_ERROR",
            "Validation failed",
            "validation-error",
            error.Detail,
            error.Errors),
        HoldManagementErrorCode.StudentIdRequired => ApiProblemDetails.Create(
            HttpContext,
            StatusCodes.Status400BadRequest,
            "STUDENT_ID_REQUIRED",
            "Student ID required",
            "student-id-required",
            error.Detail,
            error.Errors),
        HoldManagementErrorCode.ClassNotFound => ApiProblemDetails.Create(
            HttpContext,
            StatusCodes.Status404NotFound,
            "CLASS_NOT_FOUND",
            "Class not found",
            "class-not-found",
            error.Detail,
            error.Errors),
        HoldManagementErrorCode.HoldNotFound => ApiProblemDetails.Create(
            HttpContext,
            StatusCodes.Status404NotFound,
            "HOLD_NOT_FOUND",
            "Hold not found",
            "hold-not-found",
            error.Detail,
            error.Errors),
        HoldManagementErrorCode.DuplicateActiveApplication => ApiProblemDetails.Create(
            HttpContext,
            StatusCodes.Status409Conflict,
            "DUPLICATE_ACTIVE_APPLICATION",
            "Duplicate active application",
            "duplicate-active-application",
            error.Detail,
            error.Errors),
        HoldManagementErrorCode.NoSeatsAvailable => ApiProblemDetails.Create(
            HttpContext,
            StatusCodes.Status409Conflict,
            "NO_SEATS_AVAILABLE",
            "No seats available",
            "no-seats-available",
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
