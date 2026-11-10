using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using SchoolAdmission.Api.Workers;
using SchoolAdmission.Application.Reservations;

namespace SchoolAdmission.Tests;

public sealed class HoldExpiryWorkerTests
{
    [Fact]
    public async Task RecoversAfterAProcessingFailureAndStopsOnCancellation()
    {
        var expiryService = new FailingThenSucceedingExpiryService();
        await using var serviceProvider = new ServiceCollection()
            .AddScoped<IHoldExpiryService>(_ => expiryService)
            .BuildServiceProvider();
        var configuration = new HoldExpiryConfiguration(1, 100);
        var worker = new HoldExpiryWorker(
            serviceProvider.GetRequiredService<IServiceScopeFactory>(),
            TimeProvider.System,
            configuration,
            NullLogger<HoldExpiryWorker>.Instance);
        using var cancellationSource = new CancellationTokenSource();

        await worker.StartAsync(cancellationSource.Token);
        await expiryService.SecondCall.WaitAsync(TimeSpan.FromSeconds(5));
        await cancellationSource.CancelAsync();
        await worker.StopAsync(CancellationToken.None);

        Assert.True(expiryService.CallCount >= 2);
    }

    private sealed class FailingThenSucceedingExpiryService : IHoldExpiryService
    {
        private readonly TaskCompletionSource secondCall = new(
            TaskCreationOptions.RunContinuationsAsynchronously);
        private int callCount;

        public int CallCount => Volatile.Read(ref callCount);

        public Task SecondCall => secondCall.Task;

        public Task<int> ExpireDueBatchAsync(
            DateTimeOffset currentUtcTime,
            int batchSize,
            CancellationToken cancellationToken)
        {
            var currentCall = Interlocked.Increment(ref callCount);
            if (currentCall == 1)
            {
                throw new InvalidOperationException("Transient test failure.");
            }

            secondCall.TrySetResult();
            return Task.FromResult(0);
        }
    }
}
