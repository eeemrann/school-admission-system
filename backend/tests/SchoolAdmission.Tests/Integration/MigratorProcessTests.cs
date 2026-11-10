using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using Npgsql;
using Testcontainers.PostgreSql;
using SchoolAdmission.Infrastructure.Persistence;

namespace SchoolAdmission.Tests.Integration;

public sealed class MigratorProcessTests
{
    [Fact]
    public async Task MissingConnectionStringReturnsExitCodeTwo()
    {
        await using var process = await MigratorProcess.StartAsync();

        var result = await process.WaitForExitAsync(TimeSpan.FromSeconds(5));

        Assert.Equal(2, result.ExitCode);
        Assert.Contains("ConnectionStrings__DefaultConnection", result.Output, StringComparison.Ordinal);
        Assert.DoesNotContain("school_admission_process_test_password", result.Output, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ActualProcessAppliesMigrationAndCanRunAgain()
    {
        await using var container = await StartDatabaseAsync();
        var connectionString = container.GetConnectionString();

        var first = await RunMigratorAsync(connectionString);
        var second = await RunMigratorAsync(connectionString);

        Assert.Equal(0, first.ExitCode);
        Assert.Contains("migrations applied successfully", first.Output, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(0, second.ExitCode);
        Assert.Contains("no migrations are pending", second.Output, StringComparison.OrdinalIgnoreCase);

        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        Assert.True(await TableExistsAsync(connection, "__EFMigrationsHistory"));
        Assert.True(await TableExistsAsync(connection, "admission_classes"));
        Assert.True(await TableExistsAsync(connection, "admission_holds"));
        Assert.Equal(1, await CountRowsAsync(connection, "__EFMigrationsHistory"));
    }

    [Fact]
    public async Task PermanentPostgresConfigurationFailuresReturnExitCodeTwoImmediately()
    {
        await using var container = await StartDatabaseAsync();
        var baseConnectionString = new NpgsqlConnectionStringBuilder(container.GetConnectionString());

        var invalidPassword = new NpgsqlConnectionStringBuilder(baseConnectionString.ConnectionString)
        {
            Password = "wrong-password"
        };
        var missingDatabase = new NpgsqlConnectionStringBuilder(baseConnectionString.ConnectionString)
        {
            Database = "school_admission_missing_database"
        };

        var authenticationResult = await RunMigratorAsync(invalidPassword.ConnectionString);
        var missingDatabaseResult = await RunMigratorAsync(missingDatabase.ConnectionString);

        Assert.Equal(2, authenticationResult.ExitCode);
        Assert.Equal(2, missingDatabaseResult.ExitCode);
        Assert.DoesNotContain("Database is not ready", authenticationResult.Output, StringComparison.Ordinal);
        Assert.DoesNotContain("Database is not ready", missingDatabaseResult.Output, StringComparison.Ordinal);
        Assert.DoesNotContain("wrong-password", authenticationResult.Output, StringComparison.Ordinal);
        Assert.DoesNotContain("school_admission_process_test_password", missingDatabaseResult.Output, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ActualProcessReturnsDatabaseUnavailableAfterBoundedRetries()
    {
        var stopwatch = Stopwatch.StartNew();

        var result = await RunMigratorAsync(
            "Host=127.0.0.1;Port=1;Database=unreachable;Username=unreachable;Password=school_admission_process_test_password",
            new Dictionary<string, string?>
            {
                ["MIGRATOR_MAX_ATTEMPTS"] = "2",
                ["MIGRATOR_RETRY_DELAY_MILLISECONDS"] = "10"
            });

        stopwatch.Stop();

        Assert.Equal(3, result.ExitCode);
        Assert.True(stopwatch.Elapsed < TimeSpan.FromSeconds(5));
        Assert.Contains("after 2 attempts", result.Output, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("school_admission_process_test_password", result.Output, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ActualProcessReturnsMigrationFailureWithoutRetryingItAsConnectivityFailure()
    {
        await using var container = await StartDatabaseAsync();
        var connectionString = container.GetConnectionString();

        await using (var connection = new NpgsqlConnection(connectionString))
        {
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand(
                "CREATE TABLE admission_classes (id integer NOT NULL)",
                connection);
            await command.ExecuteNonQueryAsync();
        }

        var result = await RunMigratorAsync(connectionString);

        Assert.Equal(4, result.ExitCode);
        Assert.Contains("Applying", result.Output, StringComparison.Ordinal);
        Assert.DoesNotContain("Database is not ready", result.Output, StringComparison.Ordinal);
        Assert.DoesNotContain("school_admission_process_test_password", result.Output, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ActualProcessHandlesPosixSigtermWithCancellationExitCode()
    {
        if (!OperatingSystem.IsLinux() && !OperatingSystem.IsMacOS())
        {
            throw Xunit.Sdk.SkipException.ForSkip("The SIGTERM process test requires POSIX signal support.");
        }

        await using var process = await MigratorProcess.StartAsync(
            "Host=127.0.0.1;Port=1;Database=unreachable;Username=unreachable;Password=school_admission_process_test_password",
            new Dictionary<string, string?>
            {
                ["MIGRATOR_MAX_ATTEMPTS"] = "15",
                ["MIGRATOR_RETRY_DELAY_MILLISECONDS"] = "2000"
            });

        await process.WaitForOutputAsync(
            line => line.Contains("Database is not ready", StringComparison.Ordinal),
            TimeSpan.FromSeconds(5));

        Assert.Equal(0, PosixSignals.Kill(process.ProcessId, PosixSignals.Sigterm));
        var result = await process.WaitForExitAsync(TimeSpan.FromSeconds(5));

        Assert.Equal(130, result.ExitCode);
        Assert.DoesNotContain("school_admission_process_test_password", result.Output, StringComparison.Ordinal);
        Assert.True(process.HasExited);
    }

    private static async Task<ProcessResult> RunMigratorAsync(
        string? connectionString,
        IReadOnlyDictionary<string, string?>? environment = null)
    {
        await using var process = await MigratorProcess.StartAsync(connectionString, environment);
        return await process.WaitForExitAsync(TimeSpan.FromSeconds(10));
    }

    private static async Task<PostgreSqlContainer> StartDatabaseAsync()
    {
        var container = new PostgreSqlBuilder("postgres:18")
            .WithDatabase("school_admission_process_test")
            .WithUsername("school_admission_process_test")
            .WithPassword("school_admission_process_test_password")
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

    private static async Task<int> CountRowsAsync(NpgsqlConnection connection, string tableName)
    {
        await using var command = new NpgsqlCommand($"SELECT COUNT(*) FROM \"{tableName}\"", connection);
        return Convert.ToInt32(await command.ExecuteScalarAsync(), CultureInfo.InvariantCulture);
    }

    private sealed class MigratorProcess : IAsyncDisposable
    {
        private readonly Process process;
        private readonly StringBuilder output = new();
        private readonly object outputLock = new();
        private readonly DataReceivedEventHandler outputHandler;
        private readonly DataReceivedEventHandler errorHandler;
        private TaskCompletionSource<string>? outputWaiter;
        private Func<string, bool>? outputPredicate;

        private MigratorProcess(Process process)
        {
            this.process = process;
            outputHandler = (_, args) => RecordOutput(args.Data);
            errorHandler = (_, args) => RecordOutput(args.Data);
            process.OutputDataReceived += outputHandler;
            process.ErrorDataReceived += errorHandler;
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
        }

        public int ProcessId => process.Id;

        public bool HasExited => process.HasExited;

        public static async Task<MigratorProcess> StartAsync(
            string? connectionString = null,
            IReadOnlyDictionary<string, string?>? environment = null)
        {
            var migratorAssembly = typeof(SchoolAdmission.Migrator.MigrationRunner).Assembly.Location;
            var migratorDll = Path.ChangeExtension(migratorAssembly, ".dll");
            Assert.True(File.Exists(migratorDll), $"Migrator executable was not built: {migratorDll}");
            Assert.True(
                File.Exists(Path.ChangeExtension(migratorDll, ".runtimeconfig.json")),
                "The migrator runtime configuration was not copied with the test output.");

            var startInfo = new ProcessStartInfo
            {
                FileName = "dotnet",
                WorkingDirectory = Path.GetDirectoryName(migratorDll)!,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };
            startInfo.ArgumentList.Add(migratorDll);

            startInfo.Environment.Remove("ConnectionStrings__DefaultConnection");
            startInfo.Environment.Remove("MIGRATOR_MAX_ATTEMPTS");
            startInfo.Environment.Remove("MIGRATOR_RETRY_DELAY_MILLISECONDS");
            if (connectionString is not null)
            {
                startInfo.Environment["ConnectionStrings__DefaultConnection"] = connectionString;
            }

            if (environment is not null)
            {
                foreach (var pair in environment)
                {
                    if (pair.Value is null)
                    {
                        startInfo.Environment.Remove(pair.Key);
                    }
                    else
                    {
                        startInfo.Environment[pair.Key] = pair.Value;
                    }
                }
            }

            var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
            try
            {
                Assert.True(process.Start(), "The migrator process could not be started.");
                return new MigratorProcess(process);
            }
            catch
            {
                process.Dispose();
                throw;
            }
        }

        public async Task<string> WaitForOutputAsync(
            Func<string, bool> predicate,
            TimeSpan timeout)
        {
            string? existingLine;
            lock (outputLock)
            {
                existingLine = output
                    .ToString()
                    .Split('\n', StringSplitOptions.RemoveEmptyEntries)
                    .FirstOrDefault(predicate);
                if (existingLine is null)
                {
                    outputPredicate = predicate;
                    outputWaiter = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
                }
            }

            if (existingLine is not null)
            {
                return existingLine;
            }

            var waiter = outputWaiter!;
            try
            {
                return await waiter.Task.WaitAsync(timeout);
            }
            finally
            {
                lock (outputLock)
                {
                    if (ReferenceEquals(outputWaiter, waiter))
                    {
                        outputWaiter = null;
                        outputPredicate = null;
                    }
                }
            }
        }

        public async Task<ProcessResult> WaitForExitAsync(TimeSpan timeout)
        {
            try
            {
                await process.WaitForExitAsync().WaitAsync(timeout);
                process.WaitForExit();
                return new ProcessResult(process.ExitCode, GetOutput());
            }
            catch (TimeoutException)
            {
                throw new TimeoutException($"Migrator process {process.Id} did not exit within {timeout}.");
            }
        }

        public async ValueTask DisposeAsync()
        {
            process.OutputDataReceived -= outputHandler;
            process.ErrorDataReceived -= errorHandler;
            if (!process.HasExited)
            {
                try
                {
                    process.Kill(entireProcessTree: true);
                    await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5));
                }
                catch (InvalidOperationException)
                {
                    // The process exited between HasExited and Kill.
                }
                catch (TimeoutException)
                {
                    Assert.Fail($"Migrator process {process.Id} did not terminate during test cleanup.");
                }
            }

            process.Dispose();
        }

        private void RecordOutput(string? line)
        {
            if (line is null)
            {
                return;
            }

            lock (outputLock)
            {
                output.AppendLine(line);
                if (outputWaiter is not null && outputPredicate?.Invoke(line) == true)
                {
                    outputWaiter.TrySetResult(line);
                }
            }
        }

        private string GetOutput()
        {
            lock (outputLock)
            {
                return output.ToString();
            }
        }
    }

    private sealed record ProcessResult(int ExitCode, string Output);

    private static class PosixSignals
    {
        public const int Sigterm = 15;

        [DllImport("libc", SetLastError = true)]
        private static extern int kill(int processId, int signal);

        public static int Kill(int processId, int signal) => kill(processId, signal);
    }
}
