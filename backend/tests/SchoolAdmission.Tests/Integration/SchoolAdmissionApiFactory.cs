using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SchoolAdmission.Infrastructure.Persistence;

namespace SchoolAdmission.Tests.Integration;

public sealed class SchoolAdmissionApiFactory(
    string connectionString,
    IReadOnlyDictionary<string, string?>? configurationOverrides = null,
    TimeProvider? timeProvider = null) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        if (configurationOverrides is not null)
        {
            builder.ConfigureAppConfiguration((_, configuration) =>
                configuration.AddInMemoryCollection(configurationOverrides));
        }

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<SchoolAdmissionDbContext>>();
            services.RemoveAll<SchoolAdmissionDbContext>();
            services.RemoveAll<TimeProvider>();
            services.AddDbContext<SchoolAdmissionDbContext>(options => options.UseNpgsql(connectionString));
            services.AddSingleton(timeProvider ?? TimeProvider.System);
        });
    }
}
