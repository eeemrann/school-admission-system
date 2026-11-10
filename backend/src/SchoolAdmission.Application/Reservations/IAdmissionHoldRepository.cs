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
}
