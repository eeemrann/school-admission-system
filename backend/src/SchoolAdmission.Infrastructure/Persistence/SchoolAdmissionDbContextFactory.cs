using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace SchoolAdmission.Infrastructure.Persistence;

public sealed class SchoolAdmissionDbContextFactory : IDesignTimeDbContextFactory<SchoolAdmissionDbContext>
{
    public SchoolAdmissionDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? Environment.GetEnvironmentVariable("ConnectionStrings:DefaultConnection")
            ?? "Host=localhost;Port=5432;Database=school_admission";

        var options = new DbContextOptionsBuilder<SchoolAdmissionDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        return new SchoolAdmissionDbContext(options);
    }
}
