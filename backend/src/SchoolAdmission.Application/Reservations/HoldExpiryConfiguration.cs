using System.Globalization;

namespace SchoolAdmission.Application.Reservations;

public sealed record HoldExpiryConfiguration
{
    public const int DefaultPollIntervalSeconds = 5;
    public const int DefaultBatchSize = 100;

    public HoldExpiryConfiguration(int pollIntervalSeconds, int batchSize)
    {
        if (pollIntervalSeconds <= 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(pollIntervalSeconds),
                pollIntervalSeconds,
                "The expiry poll interval must be a positive number of seconds.");
        }

        if (batchSize <= 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(batchSize),
                batchSize,
                "The expiry batch size must be a positive number.");
        }

        PollIntervalSeconds = pollIntervalSeconds;
        BatchSize = batchSize;
    }

    public int PollIntervalSeconds { get; }

    public int BatchSize { get; }

    public TimeSpan PollInterval => TimeSpan.FromSeconds(PollIntervalSeconds);

    public static HoldExpiryConfiguration Parse(
        string? rawPollIntervalSeconds,
        string? rawBatchSize)
    {
        return new(
            ParsePositiveInteger(
                rawPollIntervalSeconds,
                DefaultPollIntervalSeconds,
                "HOLD_EXPIRY_POLL_INTERVAL_SECONDS"),
            ParsePositiveInteger(
                rawBatchSize,
                DefaultBatchSize,
                "HOLD_EXPIRY_BATCH_SIZE"));
    }

    private static int ParsePositiveInteger(
        string? rawValue,
        int defaultValue,
        string configurationKey)
    {
        if (rawValue is null)
        {
            return defaultValue;
        }

        if (!int.TryParse(
                rawValue,
                NumberStyles.Integer,
                CultureInfo.InvariantCulture,
                out var value)
            || value <= 0)
        {
            throw new InvalidOperationException(
                $"{configurationKey} must be a positive integer when specified.");
        }

        return value;
    }
}
