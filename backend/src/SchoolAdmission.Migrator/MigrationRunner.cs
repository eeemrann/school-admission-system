using System.Data.Common;
using System.Net.Sockets;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using SchoolAdmission.Infrastructure.Persistence;

namespace SchoolAdmission.Migrator;

public sealed record MigrationRunnerOptions
{
    public const int DefaultMaxAttempts = 15;
    public const int DefaultRetryDelayMilliseconds = 2_000;
    public const int MaximumConfiguredAttempts = 15;
    public const int MaximumConfiguredRetryDelayMilliseconds = 2_000;

    public int MaxAttempts { get; init; } = DefaultMaxAttempts;

    public TimeSpan RetryDelay { get; init; } = TimeSpan.FromMilliseconds(DefaultRetryDelayMilliseconds);

    public static bool TryReadFromEnvironment(
        out MigrationRunnerOptions options,
        out string? error)
    {
        options = new MigrationRunnerOptions();
        error = null;

        if (!TryReadBoundedInteger(
                "MIGRATOR_MAX_ATTEMPTS",
                DefaultMaxAttempts,
                1,
                MaximumConfiguredAttempts,
                out var maxAttempts,
                out error)
            || !TryReadBoundedInteger(
                "MIGRATOR_RETRY_DELAY_MILLISECONDS",
                DefaultRetryDelayMilliseconds,
                0,
                MaximumConfiguredRetryDelayMilliseconds,
                out var retryDelayMilliseconds,
                out error))
        {
            return false;
        }

        options = new MigrationRunnerOptions
        {
            MaxAttempts = maxAttempts,
            RetryDelay = TimeSpan.FromMilliseconds(retryDelayMilliseconds)
        };
        return true;
    }

    private static bool TryReadBoundedInteger(
        string variableName,
        int defaultValue,
        int minimum,
        int maximum,
        out int value,
        out string? error)
    {
        var rawValue = Environment.GetEnvironmentVariable(variableName);
        if (rawValue is null)
        {
            value = defaultValue;
            error = null;
            return true;
        }

        if (!int.TryParse(rawValue, out value) || value < minimum || value > maximum)
        {
            error = $"{variableName} must be an integer from {minimum} to {maximum}.";
            return false;
        }

        error = null;
        return true;
    }
}

public enum MigrationExitCode
{
    Success = 0,
    MissingConfiguration = 2,
    DatabaseUnavailable = 3,
    MigrationFailed = 4,
    Cancelled = 130
}

public static class MigrationRunner
{
    public static async Task<int> RunAsync(
        string? connectionString,
        MigrationRunnerOptions options,
        Action<string>? log = null,
        CancellationToken cancellationToken = default)
    {
        log ??= Console.WriteLine;

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            log("ConnectionStrings__DefaultConnection is required.");
            return (int)MigrationExitCode.MissingConfiguration;
        }

        if (options.MaxAttempts is < 1 or > MigrationRunnerOptions.MaximumConfiguredAttempts
            || options.RetryDelay < TimeSpan.Zero
            || options.RetryDelay > TimeSpan.FromMilliseconds(MigrationRunnerOptions.MaximumConfiguredRetryDelayMilliseconds))
        {
            log("Migrator retry settings are invalid.");
            return (int)MigrationExitCode.MissingConfiguration;
        }

        try
        {
            var dbContextOptions = new DbContextOptionsBuilder<SchoolAdmissionDbContext>()
                .UseNpgsql(connectionString)
                .Options;

            await using var dbContext = new SchoolAdmissionDbContext(dbContextOptions);
            var connection = dbContext.Database.GetDbConnection();
            var connectionResult = await OpenConnectionWithRetryAsync(
                connection,
                options,
                log,
                cancellationToken);

            if (connectionResult != ConnectionOpenResult.Open)
            {
                return (int)connectionResult.ToExitCode();
            }

            string[] pendingMigrations;
            try
            {
                pendingMigrations = (await dbContext.Database.GetPendingMigrationsAsync(cancellationToken)).ToArray();
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                log("Migration was cancelled.");
                return (int)MigrationExitCode.Cancelled;
            }
            catch (Exception exception)
            {
                var connectionFailure = ClassifyConnectionFailure(exception);
                if (connectionFailure.Kind == ConnectionFailureKind.Transient)
                {
                    log($"Database connectivity failed while reading migration metadata ({connectionFailure.Description}).");
                    return (int)MigrationExitCode.DatabaseUnavailable;
                }

                if (connectionFailure.Kind == ConnectionFailureKind.Permanent)
                {
                    log($"Database configuration was rejected while reading migration metadata ({connectionFailure.Description}).");
                    return (int)MigrationExitCode.MissingConfiguration;
                }

                log($"Migration metadata lookup failed ({DescribeFailure(exception)}).");
                return (int)MigrationExitCode.MigrationFailed;
            }

            if (pendingMigrations.Length == 0)
            {
                log("Database schema is already up to date; no migrations are pending.");
                return (int)MigrationExitCode.Success;
            }

            try
            {
                log($"Applying {pendingMigrations.Length} pending migration(s).");
                await dbContext.Database.MigrateAsync(cancellationToken);
                log("Database migrations applied successfully.");
                return (int)MigrationExitCode.Success;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                log("Migration was cancelled.");
                return (int)MigrationExitCode.Cancelled;
            }
            catch (Exception exception)
            {
                log($"Migration failed ({DescribeFailure(exception)}).");
                return (int)MigrationExitCode.MigrationFailed;
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            log("Migration was cancelled.");
            return (int)MigrationExitCode.Cancelled;
        }
        catch (Exception exception)
        {
            var connectionFailure = ClassifyConnectionFailure(exception);
            if (connectionFailure.Kind == ConnectionFailureKind.Transient)
            {
                log($"Database connectivity failed while reading migration metadata ({connectionFailure.Description}).");
                return (int)MigrationExitCode.DatabaseUnavailable;
            }

            if (connectionFailure.Kind == ConnectionFailureKind.Permanent)
            {
                log($"Database configuration was rejected while reading migration metadata ({connectionFailure.Description}).");
                return (int)MigrationExitCode.MissingConfiguration;
            }

            log($"Migration failed ({DescribeFailure(exception)}).");
            return (int)MigrationExitCode.MigrationFailed;
        }
    }

    private static async Task<ConnectionOpenResult> OpenConnectionWithRetryAsync(
        DbConnection connection,
        MigrationRunnerOptions options,
        Action<string> log,
        CancellationToken cancellationToken)
    {
        for (var attempt = 1; attempt <= options.MaxAttempts; attempt++)
        {
            try
            {
                await connection.OpenAsync(cancellationToken);
                return ConnectionOpenResult.Open;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                log("Migration was cancelled.");
                return ConnectionOpenResult.Cancelled;
            }
            catch (Exception exception)
            {
                var failure = ClassifyConnectionFailure(exception);
                if (failure.Kind == ConnectionFailureKind.Permanent
                    || failure.Kind == ConnectionFailureKind.Unknown)
                {
                    log($"Database connection was rejected ({failure.Description}).");
                    return ConnectionOpenResult.PermanentFailure;
                }

                if (attempt == options.MaxAttempts)
                {
                    log($"Database remained unavailable after {options.MaxAttempts} attempts ({failure.Description}).");
                    return ConnectionOpenResult.TransientFailureExhausted;
                }

                log($"Database is not ready (attempt {attempt}/{options.MaxAttempts}); retrying ({failure.Description}).");
                connection.Close();
                try
                {
                    await Task.Delay(options.RetryDelay, cancellationToken);
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    log("Migration was cancelled.");
                    return ConnectionOpenResult.Cancelled;
                }
            }
        }

        return ConnectionOpenResult.TransientFailureExhausted;
    }

    private static ConnectionFailure ClassifyConnectionFailure(Exception exception)
    {
        var postgresException = FindException<PostgresException>(exception);
        if (postgresException is not null)
        {
            if (IsPermanentSqlState(postgresException.SqlState))
            {
                return new ConnectionFailure(
                    ConnectionFailureKind.Permanent,
                    $"PostgreSQL SQLSTATE {postgresException.SqlState}");
            }

            if (postgresException.IsTransient || IsTransientSqlState(postgresException.SqlState))
            {
                return new ConnectionFailure(
                    ConnectionFailureKind.Transient,
                    $"PostgreSQL SQLSTATE {postgresException.SqlState}");
            }

            return new ConnectionFailure(
                ConnectionFailureKind.Unknown,
                $"PostgreSQL SQLSTATE {postgresException.SqlState}");
        }

        var socketException = FindException<SocketException>(exception);
        if (socketException is not null)
        {
            return socketException.SocketErrorCode switch
            {
                SocketError.HostNotFound or SocketError.NoData or SocketError.AccessDenied
                    => new ConnectionFailure(ConnectionFailureKind.Permanent, socketException.SocketErrorCode.ToString()),
                SocketError.TryAgain or SocketError.TimedOut or SocketError.ConnectionRefused
                    or SocketError.ConnectionReset or SocketError.ConnectionAborted
                    or SocketError.NetworkDown or SocketError.NetworkUnreachable
                    or SocketError.HostUnreachable or SocketError.Interrupted
                    => new ConnectionFailure(ConnectionFailureKind.Transient, socketException.SocketErrorCode.ToString()),
                _ => new ConnectionFailure(ConnectionFailureKind.Unknown, socketException.SocketErrorCode.ToString())
            };
        }

        var npgsqlException = FindException<NpgsqlException>(exception);
        if (npgsqlException?.IsTransient == true)
        {
            return new ConnectionFailure(ConnectionFailureKind.Transient, "transient Npgsql failure");
        }

        if (exception is TimeoutException)
        {
            return new ConnectionFailure(ConnectionFailureKind.Transient, "connection timeout");
        }

        if (exception is ArgumentException or FormatException)
        {
            return new ConnectionFailure(ConnectionFailureKind.Permanent, "invalid connection configuration");
        }

        return new ConnectionFailure(ConnectionFailureKind.Unknown, exception.GetType().Name);
    }

    private static bool IsPermanentSqlState(string sqlState) =>
        sqlState.StartsWith("28", StringComparison.Ordinal)
        || sqlState == "3D000";

    private static bool IsTransientSqlState(string sqlState) =>
        sqlState.StartsWith("08", StringComparison.Ordinal)
        || sqlState is "53300" or "57P03";

    private static TException? FindException<TException>(Exception exception)
        where TException : Exception
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is TException matchingException)
            {
                return matchingException;
            }
        }

        return null;
    }

    private static string DescribeFailure(Exception exception) => exception switch
    {
        FileNotFoundException fileNotFound when !string.IsNullOrWhiteSpace(fileNotFound.FileName)
            => $"missing file {Path.GetFileName(fileNotFound.FileName)}",
        DllNotFoundException dllNotFound
            => $"missing native dependency {dllNotFound.Message.Split('(', 2)[0].Trim()}",
        _ => exception.GetType().Name
    };

    private enum ConnectionOpenResult
    {
        Open,
        PermanentFailure,
        TransientFailureExhausted,
        Cancelled
    }

    private enum ConnectionFailureKind
    {
        Transient,
        Permanent,
        Unknown
    }

    private sealed record ConnectionFailure(ConnectionFailureKind Kind, string Description);

    private static MigrationExitCode ToExitCode(this ConnectionOpenResult result) => result switch
    {
        ConnectionOpenResult.Open => MigrationExitCode.Success,
        ConnectionOpenResult.PermanentFailure => MigrationExitCode.MissingConfiguration,
        ConnectionOpenResult.TransientFailureExhausted => MigrationExitCode.DatabaseUnavailable,
        ConnectionOpenResult.Cancelled => MigrationExitCode.Cancelled,
        _ => MigrationExitCode.MigrationFailed
    };
}
