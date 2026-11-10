using System.Runtime.InteropServices;

namespace SchoolAdmission.Migrator;

public static class Program
{
    public static async Task<int> Main()
    {
        using var cancellationTokenSource = new CancellationTokenSource();
        using var sigtermRegistration = PosixSignalRegistration.Create(
            PosixSignal.SIGTERM,
            context =>
            {
                context.Cancel = true;
                cancellationTokenSource.Cancel();
            });

        ConsoleCancelEventHandler cancelHandler = (_, eventArgs) =>
        {
            eventArgs.Cancel = true;
            cancellationTokenSource.Cancel();
        };

        Console.CancelKeyPress += cancelHandler;

        try
        {
            var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
            if (!MigrationRunnerOptions.TryReadFromEnvironment(out var options, out var configurationError))
            {
                Console.Error.WriteLine(configurationError);
                return (int)MigrationExitCode.MissingConfiguration;
            }

            return await MigrationRunner.RunAsync(
                connectionString,
                options,
                Console.WriteLine,
                cancellationTokenSource.Token);
        }
        catch (OperationCanceledException) when (cancellationTokenSource.IsCancellationRequested)
        {
            Console.Error.WriteLine("Migration was cancelled.");
            return (int)MigrationExitCode.Cancelled;
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine($"Migrator failed ({exception.GetType().Name}).");
            return (int)MigrationExitCode.MigrationFailed;
        }
        finally
        {
            Console.CancelKeyPress -= cancelHandler;
        }
    }
}
