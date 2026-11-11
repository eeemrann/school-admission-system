using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Domain.Entities;
using SchoolAdmission.Infrastructure.Persistence;

namespace SchoolAdmission.Tests.Integration;

[Collection(PostgresDatabaseCollectionDefinition.Name)]
public sealed class ClassEndpointsTests : IDisposable
{
    private readonly PostgresFixture fixture;
    private readonly SchoolAdmissionApiFactory factory;

    public ClassEndpointsTests(PostgresFixture fixture)
    {
        this.fixture = fixture;
        factory = new SchoolAdmissionApiFactory(fixture.ConnectionString);
    }

    public void Dispose()
    {
        factory.Dispose();
    }

    [Fact]
    public async Task CreatesValidClass()
    {
        using var client = CreateClient();
        var request = new CreateClassRequest("Class 6 - Morning Shift", 120);

        using var response = await client.PostAsJsonAsync("/classes", request);
        var created = await response.Content.ReadFromJsonAsync<CreatedClassResponse>();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(created);
        Assert.StartsWith("c_", created.Id, StringComparison.Ordinal);
        Assert.Equal(request.Name, created.Name);
        Assert.Equal(request.TotalSeats, created.TotalSeats);
    }

    [Fact]
    public async Task TrimsClassName()
    {
        using var client = CreateClient();

        using var response = await client.PostAsJsonAsync(
            "/classes",
            new CreateClassRequest("  Class 7  ", 50));
        var created = await response.Content.ReadFromJsonAsync<CreatedClassResponse>();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("Class 7", created?.Name);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task RejectsEmptyOrWhitespaceClassNames(string? name)
    {
        using var client = CreateClient();

        using var response = await client.PostAsJsonAsync(
            "/classes",
            new CreateClassRequest(name, 50));

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "VALIDATION_ERROR");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task RejectsNonPositiveSeatCounts(int totalSeats)
    {
        using var client = CreateClient();

        using var response = await client.PostAsJsonAsync(
            "/classes",
            new CreateClassRequest("Invalid Class", totalSeats));

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "VALIDATION_ERROR");
    }

    [Fact]
    public async Task ListsClasses()
    {
        using var client = CreateClient();
        var name = $"List Class {Guid.NewGuid():N}";

        using var createResponse = await client.PostAsJsonAsync(
            "/classes",
            new CreateClassRequest(name, 25));
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        using var response = await client.GetAsync("/classes");
        var classes = await response.Content.ReadFromJsonAsync<List<ClassSummaryResponse>>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(classes ?? [], admissionClass => admissionClass.Name == name);
    }

    [Fact]
    public async Task RetrievesClassById()
    {
        using var client = CreateClient();
        var created = await CreateClassAsync(client, "Retrieve Class", 35);

        using var response = await client.GetAsync($"/classes/{created.Id}");
        var retrieved = await response.Content.ReadFromJsonAsync<ClassSummaryResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(created.Id, retrieved?.Id);
        Assert.Equal(created.Name, retrieved?.Name);
        Assert.Equal(created.TotalSeats, retrieved?.TotalSeats);
    }

    [Fact]
    public async Task UpdatesClassNameWithoutChangingCapacity()
    {
        using var client = CreateClient();
        var created = await CreateClassAsync(client, "Acceptance workflow 1794352631510", 35);

        using var response = await client.PatchAsJsonAsync(
            $"/classes/{created.Id}",
            new UpdateClassRequest("  Class 6 — Morning Shift  "));
        var updated = await response.Content.ReadFromJsonAsync<ClassSummaryResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Class 6 — Morning Shift", updated?.Name);
        Assert.Equal(created.Id, updated?.Id);
        Assert.Equal(35, updated?.TotalSeats);
        Assert.Equal(35, updated?.AvailableSeats);
    }

    [Fact]
    public async Task IncreasesClassCapacityWithoutChangingSeatCounters()
    {
        using var client = CreateClient();
        var created = await CreateClassAsync(client, "Capacity expansion class", 20);

        using var response = await client.PatchAsJsonAsync(
            $"/classes/{created.Id}",
            new UpdateClassRequest(null, 30));
        var updated = await response.Content.ReadFromJsonAsync<ClassSummaryResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(created.Id, updated?.Id);
        Assert.Equal(30, updated?.TotalSeats);
        Assert.Equal(30, updated?.AvailableSeats);
        Assert.Equal(0, updated?.HeldSeats);
        Assert.Equal(0, updated?.ConfirmedSeats);
    }

    [Fact]
    public async Task RejectsClassCapacityDecrease()
    {
        using var client = CreateClient();
        var created = await CreateClassAsync(client, "Protected capacity class", 30);

        using var response = await client.PatchAsJsonAsync(
            $"/classes/{created.Id}",
            new UpdateClassRequest(null, 20));

        await AssertProblemAsync(response, HttpStatusCode.Conflict, "CAPACITY_CANNOT_DECREASE");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task RejectsEmptyClassNameUpdates(string? name)
    {
        using var client = CreateClient();
        var created = await CreateClassAsync(client, "Readable Class", 20);

        using var response = await client.PatchAsJsonAsync(
            $"/classes/{created.Id}",
            new UpdateClassRequest(name));

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "VALIDATION_ERROR");
    }

    [Fact]
    public async Task ReturnsNotFoundWhenUpdatingUnknownClass()
    {
        using var client = CreateClient();

        using var response = await client.PatchAsJsonAsync(
            $"/classes/c_{Guid.NewGuid():N}",
            new UpdateClassRequest("Readable Class"));

        await AssertProblemAsync(response, HttpStatusCode.NotFound, "CLASS_NOT_FOUND");
    }

    [Fact]
    public async Task ReturnsNotFoundForUnknownClass()
    {
        using var client = CreateClient();

        using var response = await client.GetAsync($"/classes/c_{Guid.NewGuid():N}");

        await AssertProblemAsync(response, HttpStatusCode.NotFound, "CLASS_NOT_FOUND");
    }

    [Fact]
    public async Task ReturnsBadRequestForMalformedClassId()
    {
        using var client = CreateClient();

        using var response = await client.GetAsync("/classes/not-a-class");

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "VALIDATION_ERROR");
    }

    [Fact]
    public async Task CalculatesAvailableSeatsFromPersistedCounters()
    {
        var admissionClass = new AdmissionClass
        {
            Id = Guid.NewGuid(),
            Name = $"Capacity Class {Guid.NewGuid():N}",
            TotalSeats = 100,
            HeldSeats = 15,
            ConfirmedSeats = 25,
            CreatedAt = DateTimeOffset.UtcNow
        };

        await using (var dbContext = fixture.CreateDbContext())
        {
            dbContext.AdmissionClasses.Add(admissionClass);
            await dbContext.SaveChangesAsync();
        }

        using var client = CreateClient();
        using var response = await client.GetAsync($"/classes/c_{admissionClass.Id:N}");
        var result = await response.Content.ReadFromJsonAsync<ClassSummaryResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(15, result?.HeldSeats);
        Assert.Equal(25, result?.ConfirmedSeats);
        Assert.Equal(60, result?.AvailableSeats);
    }

    [Fact]
    public async Task NewClassStartsWithZeroSeatCounters()
    {
        using var client = CreateClient();
        var created = await CreateClassAsync(client, "Initial Counters Class", 40);

        using var response = await client.GetAsync($"/classes/{created.Id}");
        var result = await response.Content.ReadFromJsonAsync<ClassSummaryResponse>();

        Assert.Equal(0, result?.HeldSeats);
        Assert.Equal(0, result?.ConfirmedSeats);
        Assert.Equal(40, result?.AvailableSeats);
    }

    [Fact]
    public async Task PersistsClassAcrossDbContextInstances()
    {
        using var client = CreateClient();
        var created = await CreateClassAsync(client, "Persistence API Class", 45);
        var id = Guid.ParseExact(created.Id[2..], "N");

        await using var dbContext = fixture.CreateDbContext();
        var persisted = await dbContext.AdmissionClasses
            .AsNoTracking()
            .SingleAsync(admissionClass => admissionClass.Id == id);

        Assert.Equal(created.Name, persisted.Name);
        Assert.Equal(created.TotalSeats, persisted.TotalSeats);
        Assert.Equal(0, persisted.HeldSeats);
        Assert.Equal(0, persisted.ConfirmedSeats);
    }

    [Fact]
    public async Task AllowsDuplicateClassNames()
    {
        using var client = CreateClient();
        var name = $"Duplicate Name {Guid.NewGuid():N}";

        var first = await CreateClassAsync(client, name, 10);
        var second = await CreateClassAsync(client, name, 20);

        Assert.NotEqual(first.Id, second.Id);
        Assert.Equal(first.Name, second.Name);
    }

    private HttpClient CreateClient() => factory.CreateClient();

    private static async Task<CreatedClassResponse> CreateClassAsync(
        HttpClient client,
        string name,
        int totalSeats)
    {
        using var response = await client.PostAsJsonAsync(
            "/classes",
            new CreateClassRequest(name, totalSeats));
        response.EnsureSuccessStatusCode();

        return (await response.Content.ReadFromJsonAsync<CreatedClassResponse>())!;
    }

    private static async Task AssertProblemAsync(
        HttpResponseMessage response,
        HttpStatusCode expectedStatus,
        string expectedCode)
    {
        Assert.Equal(expectedStatus, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemResponse>();

        Assert.NotNull(problem);
        Assert.Equal(expectedCode, problem.Code);
    }

    private sealed record CreateClassRequest(string? Name, int TotalSeats);

    private sealed record UpdateClassRequest(string? Name, int? TotalSeats = null);

    private sealed record CreatedClassResponse(string Id, string Name, int TotalSeats);

    private sealed record ClassSummaryResponse(
        string Id,
        string Name,
        int TotalSeats,
        int HeldSeats,
        int ConfirmedSeats,
        int AvailableSeats);

    private sealed record ProblemResponse(string? Code);
}
