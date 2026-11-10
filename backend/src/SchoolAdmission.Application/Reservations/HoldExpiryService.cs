namespace SchoolAdmission.Application.Reservations;

public sealed class HoldExpiryService(IAdmissionHoldRepository repository) : IHoldExpiryService
{
    public Task<int> ExpireDueBatchAsync(
        DateTimeOffset currentUtcTime,
        int batchSize,
        CancellationToken cancellationToken)
    {
        return repository.ExpireDueBatchAsync(currentUtcTime, batchSize, cancellationToken);
    }
}
