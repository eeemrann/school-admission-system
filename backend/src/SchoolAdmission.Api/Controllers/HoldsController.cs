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

    [HttpPost("/holds/{holdId}/confirm")]
    [ProducesResponseType(typeof(HoldConfirmationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<HoldConfirmationResponse>> Confirm(
        string holdId,
        [FromHeader(Name = "X-Student-Id")] string? studentId,
        CancellationToken cancellationToken)
    {
        var result = await holdReservationService.ConfirmAsync(holdId, studentId, cancellationToken);

        if (!result.IsSuccess)
        {
            return ToProblem(result.Error!);
        }

        return Ok(result.Value);
    }

    [HttpDelete("/holds/{holdId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Cancel(
        string holdId,
        [FromHeader(Name = "X-Student-Id")] string? studentId,
        CancellationToken cancellationToken)
    {
        var result = await holdReservationService.CancelAsync(holdId, studentId, cancellationToken);

        if (!result.IsSuccess)
        {
            return ToProblem(result.Error!);
        }

        return NoContent();
    }

    [HttpGet("/me/holds")]
    [ProducesResponseType(typeof(IReadOnlyList<HoldHistoryResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<IReadOnlyList<HoldHistoryResponse>>> ListForStudent(
        [FromHeader(Name = "X-Student-Id")] string? studentId,
        CancellationToken cancellationToken)
    {
        var result = await holdReservationService.ListForStudentAsync(studentId, cancellationToken);

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
        HoldManagementErrorCode.HoldOwnerForbidden => ApiProblemDetails.Create(
            HttpContext,
            StatusCodes.Status403Forbidden,
            "HOLD_OWNER_FORBIDDEN",
            "Hold owner mismatch",
            "hold-owner-forbidden",
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
        HoldManagementErrorCode.HoldExpired => ApiProblemDetails.Create(
            HttpContext,
            StatusCodes.Status409Conflict,
            "HOLD_EXPIRED",
            "Hold expired",
            "hold-expired",
            error.Detail,
            error.Errors),
        HoldManagementErrorCode.HoldCancelled => ApiProblemDetails.Create(
            HttpContext,
            StatusCodes.Status409Conflict,
            "HOLD_CANCELLED",
            "Hold cancelled",
            "hold-cancelled",
            error.Detail,
            error.Errors),
        HoldManagementErrorCode.ConfirmedHoldCannotCancel => ApiProblemDetails.Create(
            HttpContext,
            StatusCodes.Status409Conflict,
            "CONFIRMED_HOLD_CANNOT_CANCEL",
            "Confirmed hold cannot be cancelled",
            "confirmed-hold-cannot-cancel",
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
