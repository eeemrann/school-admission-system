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

    Task<HoldOperationResult<HoldConfirmationResponse>> ConfirmAsync(
        string? publicHoldId,
        string? studentId,
        CancellationToken cancellationToken);

    Task<HoldOperationResult<bool>> CancelAsync(
        string? publicHoldId,
        string? studentId,
        CancellationToken cancellationToken);

    Task<HoldOperationResult<IReadOnlyList<HoldHistoryResponse>>> ListForStudentAsync(
        string? studentId,
        CancellationToken cancellationToken);
}
