namespace SchoolAdmission.Application.Reservations;

public interface IHoldExpiryService
{
    Task<int> ExpireDueBatchAsync(
        DateTimeOffset currentUtcTime,
        int batchSize,
        CancellationToken cancellationToken);
}
