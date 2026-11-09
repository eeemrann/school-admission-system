using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SchoolAdmission.Infrastructure.Persistence;

namespace SchoolAdmission.Tests.Integration;

public sealed class SchoolAdmissionApiFactory(string connectionString) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<SchoolAdmissionDbContext>>();
            services.RemoveAll<SchoolAdmissionDbContext>();
            services.AddDbContext<SchoolAdmissionDbContext>(options => options.UseNpgsql(connectionString));
        });
    }
}
