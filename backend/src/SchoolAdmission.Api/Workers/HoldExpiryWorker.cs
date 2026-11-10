using Microsoft.Extensions.DependencyInjection;
using SchoolAdmission.Application.Reservations;

namespace SchoolAdmission.Api.Workers;

public sealed class HoldExpiryWorker(
    IServiceScopeFactory scopeFactory,
    TimeProvider timeProvider,
    HoldExpiryConfiguration configuration,
    ILogger<HoldExpiryWorker> logger) : BackgroundService
{
    private static readonly Action<ILogger, int, int, Exception?> WorkerStarted =
        LoggerMessage.Define<int, int>(
            LogLevel.Information,
            new EventId(1, nameof(WorkerStarted)),
            "Hold expiry worker started with a {PollIntervalSeconds}-second poll interval and batch size {BatchSize}.");

    private static readonly Action<ILogger, int, Exception?> ApplicationsExpired =
        LoggerMessage.Define<int>(
            LogLevel.Information,
            new EventId(2, nameof(ApplicationsExpired)),
            "Hold expiry worker expired {ExpiredCount} application(s).");

    private static readonly Action<ILogger, Exception?> ProcessingFailed =
        LoggerMessage.Define(
            LogLevel.Error,
            new EventId(3, nameof(ProcessingFailed)),
            "Hold expiry processing failed; the worker will retry on the next poll cycle.");

    private static readonly Action<ILogger, Exception?> WorkerStopped =
        LoggerMessage.Define(
            LogLevel.Information,
            new EventId(4, nameof(WorkerStopped)),
            "Hold expiry worker stopped.");

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        WorkerStarted(logger, configuration.PollIntervalSeconds, configuration.BatchSize, null);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var expiryService = scope.ServiceProvider.GetRequiredService<IHoldExpiryService>();
                var expiredCount = await expiryService.ExpireDueBatchAsync(
                    timeProvider.GetUtcNow(),
                    configuration.BatchSize,
                    stoppingToken);

                if (expiredCount > 0)
                {
                    ApplicationsExpired(logger, expiredCount, null);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                ProcessingFailed(logger, exception);
            }

            try
            {
                await Task.Delay(configuration.PollInterval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }

        WorkerStopped(logger, null);
    }
}
