namespace SchoolAdmission.Tests;

public sealed class FoundationSmokeTests
{
    [Fact]
    public void TestProjectIsConfigured()
    {
        Assert.Equal("SchoolAdmission.Tests", typeof(FoundationSmokeTests).Assembly.GetName().Name);
    }
}
