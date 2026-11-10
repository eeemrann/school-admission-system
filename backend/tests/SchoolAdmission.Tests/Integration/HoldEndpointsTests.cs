using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Domain.Entities;
using SchoolAdmission.Domain.Enums;
using SchoolAdmission.Infrastructure.Persistence;

namespace SchoolAdmission.Tests.Integration;

[Collection(PostgresDatabaseCollectionDefinition.Name)]
public sealed class HoldEndpointsTests : IDisposable
{
    private readonly PostgresFixture fixture;
    private readonly SchoolAdmissionApiFactory factory;

    public HoldEndpointsTests(PostgresFixture fixture)
    {
        this.fixture = fixture;
        factory = new SchoolAdmissionApiFactory(fixture.ConnectionString);
    }

    public void Dispose()
    {
        factory.Dispose();
    }

    [Fact]
    public async Task CreatesHoldWithExpectedResponse()
    {
        using var client = CreateClient();
        var admissionClass = await CreateClassAsync(client, 3);

        using var response = await CreateHoldAsync(client, admissionClass.Id, "student-1");
        var hold = await response.Content.ReadFromJsonAsync<CreatedHoldResponse>();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(hold);
        Assert.StartsWith("h_", hold.HoldId, StringComparison.Ordinal);
        Assert.Equal(admissionClass.Id, hold.ClassId);
        Assert.Equal("student-1", hold.StudentId);
        Assert.Equal("HELD", hold.Status);
        Assert.InRange(
            hold.ExpiresAt,
            DateTimeOffset.UtcNow.AddSeconds(590),
            DateTimeOffset.UtcNow.AddSeconds(610));
    }

    [Fact]
    public async Task TrimsStudentId()
    {
        using var client = CreateClient();
        var admissionClass = await CreateClassAsync(client, 2);

        using var response = await CreateHoldAsync(client, admissionClass.Id, "  student-trimmed  ");
        var hold = await response.Content.ReadFromJsonAsync<CreatedHoldResponse>();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("student-trimmed", hold?.StudentId);
    }

    [Fact]
    public async Task RejectsMissingStudentId()
    {
        using var client = CreateClient();
        var admissionClass = await CreateClassAsync(client, 2);

        using var response = await client.PostAsync(
            $"/classes/{admissionClass.Id}/holds",
            content: null);

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "STUDENT_ID_REQUIRED");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task RejectsBlankStudentId(string studentId)
    {
        using var client = CreateClient();
        var admissionClass = await CreateClassAsync(client, 2);

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"/classes/{admissionClass.Id}/holds");
        request.Headers.TryAddWithoutValidation("X-Student-Id", studentId);

        using var response = await client.SendAsync(request);

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "STUDENT_ID_REQUIRED");
    }

    [Fact]
    public async Task RejectsMalformedClassId()
    {
        using var client = CreateClient();

        using var response = await CreateHoldAsync(client, "not-a-class", "student-malformed");

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "VALIDATION_ERROR");
    }

    [Fact]
    public async Task RejectsUnknownClassId()
    {
        using var client = CreateClient();

        using var response = await CreateHoldAsync(
            client,
            $"c_{Guid.NewGuid():N}",
            "student-unknown-class");

        await AssertProblemAsync(response, HttpStatusCode.NotFound, "CLASS_NOT_FOUND");
    }

    [Fact]
    public async Task RejectsWhenNoSeatsAreAvailableWithoutChangingCounters()
    {
        using var client = CreateClient();
        var seeded = await SeedClassWithHoldAsync(
            totalSeats: 1,
            heldSeats: 1,
            holdStatus: HoldStatus.Held,
            studentId: "student-existing");

        using var response = await CreateHoldAsync(client, seeded.ClassId, "student-new");

        await AssertProblemAsync(response, HttpStatusCode.Conflict, "NO_SEATS_AVAILABLE");
        await using var dbContext = fixture.CreateDbContext();
        var admissionClass = await dbContext.AdmissionClasses.SingleAsync(item => item.Id == seeded.ClassIdGuid);
        var holdCount = await dbContext.AdmissionHolds.CountAsync(item => item.ClassId == seeded.ClassIdGuid);

        Assert.Equal(1, admissionClass.HeldSeats);
        Assert.Equal(1, holdCount);
    }

    [Fact]
    public async Task ConcurrentHoldsCannotExceedCapacity()
    {
        using var classClient = CreateClient();
        var admissionClass = await CreateClassAsync(classClient, 1);
        using var firstClient = CreateClient();
        using var secondClient = CreateClient();

        var firstTask = CreateHoldAsync(firstClient, admissionClass.Id, "student-concurrent-1");
        var secondTask = CreateHoldAsync(secondClient, admissionClass.Id, "student-concurrent-2");
        await Task.WhenAll(firstTask, secondTask);

        using var firstResponse = await firstTask;
        using var secondResponse = await secondTask;
        var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode };

        Assert.Contains(HttpStatusCode.Created, statuses);
        Assert.Contains(HttpStatusCode.Conflict, statuses);

        await using var dbContext = fixture.CreateDbContext();
        var persistedClass = await dbContext.AdmissionClasses
            .AsNoTracking()
            .SingleAsync(item => item.Id == admissionClass.ClassIdGuid);
        var persistedHolds = await dbContext.AdmissionHolds
            .AsNoTracking()
            .Where(item => item.ClassId == admissionClass.ClassIdGuid)
            .ToListAsync();

        Assert.Equal(1, persistedClass.HeldSeats);
        Assert.Single(persistedHolds);
    }

    [Fact]
    public async Task RejectsDuplicateHeldApplication()
    {
        using var client = CreateClient();
        var admissionClass = await CreateClassAsync(client, 2);

        using var firstResponse = await CreateHoldAsync(client, admissionClass.Id, "student-duplicate");
        Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);

        using var duplicateResponse = await CreateHoldAsync(client, admissionClass.Id, "student-duplicate");

        await AssertProblemAsync(
            duplicateResponse,
            HttpStatusCode.Conflict,
            "DUPLICATE_ACTIVE_APPLICATION");
    }

    [Fact]
    public async Task RejectsDuplicateConfirmedApplication()
    {
        var seeded = await SeedClassWithHoldAsync(
            totalSeats: 2,
            heldSeats: 0,
            confirmedSeats: 1,
            holdStatus: HoldStatus.Confirmed,
            studentId: "student-confirmed");
        using var client = CreateClient();

        using var response = await CreateHoldAsync(client, seeded.ClassId, "student-confirmed");

        await AssertProblemAsync(
            response,
            HttpStatusCode.Conflict,
            "DUPLICATE_ACTIVE_APPLICATION");
    }

    [Fact]
    public async Task UnrelatedUniqueViolationReturnsInternalError()
    {
        const string indexName = "ux_test_unrelated_student_http_constraint";
        const string studentId = "student-unrelated-http-index";

        await using var setupContext = fixture.CreateDbContext();
        await setupContext.Database.ExecuteSqlRawAsync(
            $"CREATE UNIQUE INDEX \"{indexName}\" ON admission_holds (student_id) WHERE student_id = '{studentId}'");

        try
        {
            using var client = CreateClient();
            var firstClass = await CreateClassAsync(client, 2);
            var secondClass = await CreateClassAsync(client, 2);

            using var firstResponse = await CreateHoldAsync(client, firstClass.Id, studentId);
            Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);

            using var secondResponse = await CreateHoldAsync(client, secondClass.Id, studentId);

            await AssertProblemAsync(
                secondResponse,
                HttpStatusCode.InternalServerError,
                "INTERNAL_ERROR");
        }
        finally
        {
            await using var cleanupContext = fixture.CreateDbContext();
            await cleanupContext.Database.ExecuteSqlRawAsync($"DROP INDEX IF EXISTS \"{indexName}\"");
        }
    }

    [Fact]
    public async Task AllowsReapplicationAfterExpiredApplication()
    {
        var seeded = await SeedClassWithHoldAsync(
            totalSeats: 1,
            heldSeats: 0,
            holdStatus: HoldStatus.Expired,
            studentId: "student-reapply-expired");
        using var client = CreateClient();

        using var response = await CreateHoldAsync(client, seeded.ClassId, seeded.StudentId);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task AllowsReapplicationAfterCancelledApplication()
    {
        var seeded = await SeedClassWithHoldAsync(
            totalSeats: 1,
            heldSeats: 0,
            holdStatus: HoldStatus.Cancelled,
            studentId: "student-reapply-cancelled");
        using var client = CreateClient();

        using var response = await CreateHoldAsync(client, seeded.ClassId, seeded.StudentId);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task ReconcilesExpiredHoldBeforeCapacityCheck()
    {
        var seeded = await SeedClassWithHoldAsync(
            totalSeats: 1,
            heldSeats: 1,
            holdStatus: HoldStatus.Held,
            studentId: "student-expiring",
            expiresIn: TimeSpan.FromMinutes(-1));
        using var client = CreateClient();

        using var response = await CreateHoldAsync(client, seeded.ClassId, "student-after-expiry");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        await using var dbContext = fixture.CreateDbContext();
        var expiredHold = await dbContext.AdmissionHolds.SingleAsync(item => item.Id == seeded.HoldId);
        var admissionClass = await dbContext.AdmissionClasses.SingleAsync(item => item.Id == seeded.ClassIdGuid);

        Assert.Equal(HoldStatus.Expired, expiredHold.Status);
        Assert.Equal(1, admissionClass.HeldSeats);
        Assert.Equal(2, await dbContext.AdmissionHolds.CountAsync(item => item.ClassId == seeded.ClassIdGuid));
    }

    [Fact]
    public async Task RepeatedExpiryReconciliationDoesNotDecrementTwice()
    {
        var seeded = await SeedClassWithHoldAsync(
            totalSeats: 1,
            heldSeats: 1,
            holdStatus: HoldStatus.Held,
            studentId: "student-reconcile-once",
            expiresIn: TimeSpan.FromMinutes(-1));
        using var client = CreateClient();

        using var firstResponse = await client.GetAsync($"/holds/{seeded.HoldPublicId}");
        using var secondResponse = await client.GetAsync($"/holds/{seeded.HoldPublicId}");

        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, secondResponse.StatusCode);
        var firstHold = await firstResponse.Content.ReadFromJsonAsync<HoldDetailsResponse>();
        var secondHold = await secondResponse.Content.ReadFromJsonAsync<HoldDetailsResponse>();
        await using var dbContext = fixture.CreateDbContext();
        var admissionClass = await dbContext.AdmissionClasses.SingleAsync(item => item.Id == seeded.ClassIdGuid);

        Assert.Equal("EXPIRED", firstHold?.Status);
        Assert.Equal("EXPIRED", secondHold?.Status);
        Assert.Equal(0, admissionClass.HeldSeats);
    }

    [Fact]
    public async Task GetsHoldFromPostgreSql()
    {
        using var client = CreateClient();
        var admissionClass = await CreateClassAsync(client, 2);
        using var createResponse = await CreateHoldAsync(client, admissionClass.Id, "student-get");
        var created = await createResponse.Content.ReadFromJsonAsync<CreatedHoldResponse>();

        using var response = await client.GetAsync($"/holds/{created!.HoldId}");
        var hold = await response.Content.ReadFromJsonAsync<HoldDetailsResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(created.HoldId, hold?.HoldId);
        Assert.Equal(created.ClassId, hold?.ClassId);
        Assert.Equal(created.Status, hold?.Status);
        Assert.Equal(TruncateToMicroseconds(created.ExpiresAt), hold?.ExpiresAt);
    }

    [Fact]
    public async Task RejectsMalformedHoldId()
    {
        using var client = CreateClient();

        using var response = await client.GetAsync("/holds/not-a-hold");

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "VALIDATION_ERROR");
    }

    [Fact]
    public async Task ReturnsNotFoundForUnknownHoldId()
    {
        using var client = CreateClient();

        using var response = await client.GetAsync($"/holds/h_{Guid.NewGuid():N}");

        await AssertProblemAsync(response, HttpStatusCode.NotFound, "HOLD_NOT_FOUND");
    }

    [Fact]
    public async Task PersistsHoldAcrossSeparateDbContextInstances()
    {
        using var client = CreateClient();
        var admissionClass = await CreateClassAsync(client, 2);
        using var createResponse = await CreateHoldAsync(client, admissionClass.Id, "student-persisted");
        var created = await createResponse.Content.ReadFromJsonAsync<CreatedHoldResponse>();
        var holdId = Guid.ParseExact(created!.HoldId[2..], "N");

        await using var dbContext = fixture.CreateDbContext();
        var persistedHold = await dbContext.AdmissionHolds
            .AsNoTracking()
            .SingleAsync(hold => hold.Id == holdId);

        Assert.Equal("student-persisted", persistedHold.StudentId);
        Assert.Equal(HoldStatus.Held, persistedHold.Status);
        Assert.Equal(admissionClass.ClassIdGuid, persistedHold.ClassId);
    }

    private HttpClient CreateClient() => factory.CreateClient();

    private static async Task<ClassResponse> CreateClassAsync(HttpClient client, int totalSeats)
    {
        var name = $"Hold Test Class {Guid.NewGuid():N}";
        using var response = await client.PostAsJsonAsync(
            "/classes",
            new CreateClassRequest(name, totalSeats));
        response.EnsureSuccessStatusCode();

        return (await response.Content.ReadFromJsonAsync<ClassResponse>())!;
    }

    private static async Task<HttpResponseMessage> CreateHoldAsync(
        HttpClient client,
        string classId,
        string? studentId)
    {
        var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"/classes/{classId}/holds");
        if (studentId is not null)
        {
            request.Headers.TryAddWithoutValidation("X-Student-Id", studentId);
        }

        return await client.SendAsync(request);
    }

    private async Task<SeededHold> SeedClassWithHoldAsync(
        int totalSeats,
        int heldSeats,
        HoldStatus holdStatus,
        string studentId,
        int confirmedSeats = 0,
        TimeSpan? expiresIn = null)
    {
        var now = DateTimeOffset.UtcNow;
        var expiresAt = expiresIn is { } configuredExpiry && configuredExpiry <= TimeSpan.Zero
            ? now.Add(configuredExpiry)
            : now.Add(expiresIn ?? TimeSpan.FromMinutes(10));
        var createdAt = expiresAt.AddMinutes(-10);
        var admissionClass = new AdmissionClass
        {
            Id = Guid.NewGuid(),
            Name = $"Seeded Hold Class {Guid.NewGuid():N}",
            TotalSeats = totalSeats,
            HeldSeats = heldSeats,
            ConfirmedSeats = confirmedSeats,
            CreatedAt = createdAt
        };
        var hold = new AdmissionHold
        {
            Id = Guid.NewGuid(),
            ClassId = admissionClass.Id,
            StudentId = studentId,
            Status = holdStatus,
            CreatedAt = createdAt,
            ExpiresAt = expiresAt
        };

        await using var dbContext = fixture.CreateDbContext();
        dbContext.AdmissionClasses.Add(admissionClass);
        dbContext.AdmissionHolds.Add(hold);
        await dbContext.SaveChangesAsync();

        return new SeededHold(
            ClassIdCodec(admissionClass.Id),
            admissionClass.Id,
            hold.Id,
            HoldIdCodec(hold.Id),
            studentId);
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

    private static string ClassIdCodec(Guid id) => $"c_{id:N}";

    private static string HoldIdCodec(Guid id) => $"h_{id:N}";

    private static DateTimeOffset TruncateToMicroseconds(DateTimeOffset value)
    {
        var utcTicks = value.UtcTicks - value.UtcTicks % TimeSpan.TicksPerMicrosecond;
        return new DateTimeOffset(utcTicks, TimeSpan.Zero);
    }

    private sealed record CreateClassRequest(string Name, int TotalSeats);

    private sealed record ClassResponse(string Id, string Name, int TotalSeats)
    {
        public Guid ClassIdGuid => Guid.ParseExact(Id[2..], "N");
    }

    private sealed record CreatedHoldResponse(
        string HoldId,
        string ClassId,
        string StudentId,
        string Status,
        DateTimeOffset ExpiresAt);

    private sealed record HoldDetailsResponse(
        string HoldId,
        string ClassId,
        string Status,
        DateTimeOffset ExpiresAt);

    private sealed record ProblemResponse(string? Code);

    private sealed record SeededHold(
        string ClassId,
        Guid ClassIdGuid,
        Guid HoldId,
        string HoldPublicId,
        string StudentId);
}
