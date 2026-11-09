using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Infrastructure.Persistence;
using Testcontainers.PostgreSql;

namespace SchoolAdmission.Tests.Integration;

public sealed class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer container = new PostgreSqlBuilder("postgres:18")
        .WithDatabase("school_admission_test")
        .WithUsername("school_admission_test")
        .WithPassword("school_admission_test")
        .Build();

    public string ConnectionString => container.GetConnectionString();

    public async Task InitializeAsync()
    {
        await container.StartAsync();

        await using var dbContext = CreateDbContext();
        await dbContext.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        await container.DisposeAsync();
    }

    public SchoolAdmissionDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<SchoolAdmissionDbContext>()
            .UseNpgsql(ConnectionString)
            .Options;

        return new SchoolAdmissionDbContext(options);
    }
}

[CollectionDefinition(Name)]
public sealed class PostgresDatabaseCollectionDefinition : ICollectionFixture<PostgresFixture>
{
    public const string Name = "postgres";
}
