using Microsoft.Extensions.Diagnostics.HealthChecks;
using SchoolAdmission.Infrastructure.Persistence;

namespace SchoolAdmission.Api.Health;

public sealed class DatabaseHealthCheck(SchoolAdmissionDbContext dbContext) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var canConnect = await dbContext.Database.CanConnectAsync(cancellationToken);

            return canConnect
                ? HealthCheckResult.Healthy("PostgreSQL is reachable.")
                : HealthCheckResult.Unhealthy("PostgreSQL is not reachable.");
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            return HealthCheckResult.Unhealthy("PostgreSQL connectivity check failed.");
        }
    }
}
