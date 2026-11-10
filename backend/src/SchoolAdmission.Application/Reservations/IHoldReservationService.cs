namespace SchoolAdmission.Application.Reservations;

public interface IHoldReservationService
{
    Task<HoldOperationResult<HoldResponse>> CreateAsync(
        string? publicClassId,
        string? studentId,
        CancellationToken cancellationToken);

    Task<HoldOperationResult<HoldDetailsResponse>> GetByIdAsync(
        string? publicHoldId,
        CancellationToken cancellationToken);
}
