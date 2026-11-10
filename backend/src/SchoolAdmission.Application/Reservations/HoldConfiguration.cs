namespace SchoolAdmission.Application.Reservations;

public sealed record HoldConfiguration
{
    public const int DefaultDurationSeconds = 600;

    public HoldConfiguration(int durationSeconds)
    {
        if (durationSeconds <= 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(durationSeconds),
                durationSeconds,
                "Hold duration must be a positive number of seconds.");
        }

        DurationSeconds = durationSeconds;
    }

    public int DurationSeconds { get; }

    public TimeSpan Duration => TimeSpan.FromSeconds(DurationSeconds);
}
