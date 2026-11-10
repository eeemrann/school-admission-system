using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using SchoolAdmission.Infrastructure.Persistence;
using SchoolAdmission.Migrator;
using Testcontainers.PostgreSql;

namespace SchoolAdmission.Tests.Integration;

public sealed class MigratorTests
{
    [Fact]
    public async Task AppliesInitialMigrationAndIsIdempotent()
    {
        await using var container = await StartDatabaseAsync();

        var firstResult = await MigrationRunner.RunAsync(
            container.GetConnectionString(),
            FastTestOptions());

        Assert.Equal((int)MigrationExitCode.Success, firstResult);

        await using (var verificationContext = CreateDbContext(container.GetConnectionString()))
        {
            var appliedMigrations = await verificationContext.Database.GetAppliedMigrationsAsync();
            Assert.Contains("20261109184037_InitialCreate", appliedMigrations);
            Assert.Empty(await verificationContext.Database.GetPendingMigrationsAsync());
        }

        await using var connection = new NpgsqlConnection(container.GetConnectionString());
        await connection.OpenAsync();
        Assert.True(await TableExistsAsync(connection, "admission_classes"));
        Assert.True(await TableExistsAsync(connection, "admission_holds"));
        Assert.True(await TableExistsAsync(connection, "__EFMigrationsHistory"));

        var secondResult = await MigrationRunner.RunAsync(
            container.GetConnectionString(),
            FastTestOptions());

        Assert.Equal((int)MigrationExitCode.Success, secondResult);
        await using var finalContext = CreateDbContext(container.GetConnectionString());
        Assert.Empty(await finalContext.Database.GetPendingMigrationsAsync());
    }

    [Fact]
    public async Task MissingConnectionStringFailsImmediatelyWithoutLoggingSecrets()
    {
        var messages = new List<string>();
        var stopwatch = Stopwatch.StartNew();

        var result = await MigrationRunner.RunAsync(
            " ",
            FastTestOptions(),
            messages.Add);

        stopwatch.Stop();

        Assert.Equal((int)MigrationExitCode.MissingConfiguration, result);
        Assert.True(stopwatch.Elapsed < TimeSpan.FromSeconds(1));
        Assert.Contains(messages, message => message.Contains("ConnectionStrings__DefaultConnection", StringComparison.Ordinal));
    }

    [Fact]
    public async Task UnreachableDatabaseFailsAfterBoundedRetries()
    {
        var messages = new List<string>();
        var stopwatch = Stopwatch.StartNew();

        var result = await MigrationRunner.RunAsync(
            "Host=127.0.0.1;Port=1;Database=unreachable;Username=unreachable;Password=unreachable",
            new MigrationRunnerOptions { MaxAttempts = 2, RetryDelay = TimeSpan.FromMilliseconds(10) },
            messages.Add);

        stopwatch.Stop();

        Assert.Equal((int)MigrationExitCode.DatabaseUnavailable, result);
        Assert.True(stopwatch.Elapsed < TimeSpan.FromSeconds(5));
        Assert.Contains(messages, message => message.Contains("unavailable", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task ApiStartupDoesNotApplyMigrations()
    {
        await using var container = await StartDatabaseAsync();
        await using var factory = new SchoolAdmissionApiFactory(
            container.GetConnectionString(),
            new Dictionary<string, string?>
            {
                ["HOLD_EXPIRY_POLL_INTERVAL_SECONDS"] = "60"
            });
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/health");

        Assert.True(response.IsSuccessStatusCode);
        await using var connection = new NpgsqlConnection(container.GetConnectionString());
        await connection.OpenAsync();
        Assert.False(await TableExistsAsync(connection, "__EFMigrationsHistory"));
        Assert.False(await TableExistsAsync(connection, "admission_classes"));
        Assert.False(await TableExistsAsync(connection, "admission_holds"));
    }

    private static MigrationRunnerOptions FastTestOptions() => new()
    {
        MaxAttempts = 3,
        RetryDelay = TimeSpan.FromMilliseconds(10)
    };

    private static SchoolAdmissionDbContext CreateDbContext(string connectionString)
    {
        var options = new DbContextOptionsBuilder<SchoolAdmissionDbContext>()
            .UseNpgsql(connectionString)
            .Options;
        return new SchoolAdmissionDbContext(options);
    }

    private static async Task<PostgreSqlContainer> StartDatabaseAsync()
    {
        var container = new PostgreSqlBuilder("postgres:18")
            .WithDatabase("school_admission_migrator_test")
            .WithUsername("school_admission_migrator_test")
            .WithPassword("school_admission_migrator_test")
            .Build();

        await container.StartAsync();
        return container;
    }

    private static async Task<bool> TableExistsAsync(NpgsqlConnection connection, string tableName)
    {
        await using var command = new NpgsqlCommand(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)",
            connection);
        command.Parameters.AddWithValue(tableName);
        return (bool)(await command.ExecuteScalarAsync() ?? false);
    }
}
