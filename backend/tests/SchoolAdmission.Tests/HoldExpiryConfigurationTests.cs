using SchoolAdmission.Application.Reservations;

namespace SchoolAdmission.Tests;

public sealed class HoldExpiryConfigurationTests
{
    [Fact]
    public void UsesApprovedDefaults()
    {
        var configuration = HoldExpiryConfiguration.Parse(null, null);

        Assert.Equal(5, configuration.PollIntervalSeconds);
        Assert.Equal(100, configuration.BatchSize);
    }

    [Theory]
    [InlineData("0", "100")]
    [InlineData("-1", "100")]
    [InlineData("not-a-number", "100")]
    [InlineData("5", "0")]
    [InlineData("5", "-1")]
    [InlineData("5", "not-a-number")]
    public void RejectsInvalidValues(string pollIntervalSeconds, string batchSize)
    {
        Assert.Throws<InvalidOperationException>(() =>
            HoldExpiryConfiguration.Parse(pollIntervalSeconds, batchSize));
    }
}
