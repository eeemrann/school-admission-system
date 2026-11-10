using SchoolAdmission.Application.Classes;
using SchoolAdmission.Domain.Entities;
using SchoolAdmission.Domain.Enums;

namespace SchoolAdmission.Application.Reservations;

public sealed class HoldReservationService(
    IAdmissionHoldRepository repository,
    TimeProvider timeProvider,
    HoldConfiguration configuration) : IHoldReservationService
{
    public async Task<HoldOperationResult<HoldResponse>> CreateAsync(
        string? publicClassId,
        string? studentId,
        CancellationToken cancellationToken)
    {
        if (!ClassIdCodec.TryParse(publicClassId, out var classId))
        {
            return new HoldOperationResult<HoldResponse>(
                null,
                ValidationError("Class ID must use the c_ prefix followed by a valid UUID."));
        }

        if (string.IsNullOrWhiteSpace(studentId))
        {
            return new HoldOperationResult<HoldResponse>(
                null,
                new HoldManagementError(
                    HoldManagementErrorCode.StudentIdRequired,
                    "X-Student-Id is required and cannot be blank."));
        }

        var normalizedStudentId = studentId.Trim();
        var result = await repository.CreateHeldAsync(
            classId,
            normalizedStudentId,
            timeProvider.GetUtcNow(),
            configuration.Duration,
            cancellationToken);

        if (!result.IsSuccess)
        {
            return new HoldOperationResult<HoldResponse>(null, MapFailure(result.Failure!.Value));
        }

        return new HoldOperationResult<HoldResponse>(MapCreatedResponse(result.Hold!), null);
    }

    public async Task<HoldOperationResult<HoldDetailsResponse>> GetByIdAsync(
        string? publicHoldId,
        CancellationToken cancellationToken)
    {
        if (!HoldIdCodec.TryParse(publicHoldId, out var holdId))
        {
            return new HoldOperationResult<HoldDetailsResponse>(
                null,
                ValidationError("Hold ID must use the h_ prefix followed by a valid UUID."));
        }

        var hold = await repository.GetByIdWithExpiryReconciliationAsync(
            holdId,
            timeProvider.GetUtcNow(),
            cancellationToken);

        return hold is null
            ? new HoldOperationResult<HoldDetailsResponse>(
                null,
                new HoldManagementError(
                    HoldManagementErrorCode.HoldNotFound,
                    "The requested hold was not found."))
            : new HoldOperationResult<HoldDetailsResponse>(MapDetailsResponse(hold), null);
    }

    private static HoldResponse MapCreatedResponse(AdmissionHold hold) =>
        new(
            HoldIdCodec.ToPublicId(hold.Id),
            ClassIdCodec.ToPublicId(hold.ClassId),
            hold.StudentId,
            ToPublicStatus(hold.Status),
            hold.ExpiresAt);

    private static HoldDetailsResponse MapDetailsResponse(AdmissionHold hold) =>
        new(
            HoldIdCodec.ToPublicId(hold.Id),
            ClassIdCodec.ToPublicId(hold.ClassId),
            ToPublicStatus(hold.Status),
            hold.ExpiresAt);

    private static string ToPublicStatus(HoldStatus status) => status switch
    {
        HoldStatus.Held => "HELD",
        HoldStatus.Confirmed => "CONFIRMED",
        HoldStatus.Expired => "EXPIRED",
        HoldStatus.Cancelled => "CANCELLED",
        _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Unknown hold status.")
    };

    private static HoldManagementError MapFailure(HoldReservationFailure failure) => failure switch
    {
        HoldReservationFailure.ClassNotFound => new(
            HoldManagementErrorCode.ClassNotFound,
            "The requested class was not found."),
        HoldReservationFailure.DuplicateActiveApplication => new(
            HoldManagementErrorCode.DuplicateActiveApplication,
            "The student already has an active application for this class."),
        HoldReservationFailure.NoSeatsAvailable => new(
            HoldManagementErrorCode.NoSeatsAvailable,
            "The requested class has no available seats."),
        _ => throw new ArgumentOutOfRangeException(nameof(failure), failure, "Unknown reservation failure.")
    };

    private static HoldManagementError ValidationError(string detail) =>
        new(HoldManagementErrorCode.ValidationError, detail);
}
