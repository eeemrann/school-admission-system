using SchoolAdmission.Domain.Entities;

namespace SchoolAdmission.Application.Reservations;

public interface IAdmissionHoldRepository
{
    Task<HoldReservationResult> CreateHeldAsync(
        Guid classId,
        string studentId,
        DateTimeOffset createdAt,
        TimeSpan duration,
        CancellationToken cancellationToken);

    Task<AdmissionHold?> GetByIdWithExpiryReconciliationAsync(
        Guid holdId,
        DateTimeOffset currentUtcTime,
        CancellationToken cancellationToken);

    Task<HoldMutationResult> ConfirmAsync(
        Guid holdId,
        string studentId,
        DateTimeOffset currentUtcTime,
        CancellationToken cancellationToken);

    Task<HoldMutationResult> CancelAsync(
        Guid holdId,
        string studentId,
        DateTimeOffset currentUtcTime,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<HoldHistoryItem>> ListForStudentAsync(
        string studentId,
        DateTimeOffset currentUtcTime,
        CancellationToken cancellationToken);

    Task<int> ExpireDueBatchAsync(
        DateTimeOffset currentUtcTime,
        int batchSize,
        CancellationToken cancellationToken);
}
