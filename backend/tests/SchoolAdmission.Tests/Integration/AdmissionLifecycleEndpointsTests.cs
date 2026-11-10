using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Domain.Entities;
using SchoolAdmission.Domain.Enums;
using SchoolAdmission.Infrastructure.Persistence;

namespace SchoolAdmission.Tests.Integration;

[Collection(PostgresDatabaseCollectionDefinition.Name)]
public sealed class AdmissionLifecycleEndpointsTests : IDisposable
{
    private readonly PostgresFixture fixture;
    private readonly SchoolAdmissionApiFactory factory;

    public AdmissionLifecycleEndpointsTests(PostgresFixture fixture)
    {
        this.fixture = fixture;
        factory = new SchoolAdmissionApiFactory(fixture.ConnectionString);
    }

    public void Dispose()
    {
        factory.Dispose();
    }

    [Fact]
    public async Task ConfirmsHeldApplicationAndMovesSeatCounters()
    {
        using var client = CreateClient();
        var admissionClass = await CreateClassAsync(client, 2);
        using var createResponse = await CreateHoldAsync(client, admissionClass.Id, "student-confirm");
        var created = await ReadRequiredAsync<CreatedHoldResponse>(createResponse);

        using var response = await SendWithStudentAsync(
            client,
            HttpMethod.Post,
            $"/holds/{created.HoldId}/confirm",
            "student-confirm");
        var confirmation = await response.Content.ReadFromJsonAsync<ConfirmationResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new ConfirmationResponse(created.HoldId, "CONFIRMED"), confirmation);

        var state = await ReadStateAsync(created.ClassId, created.HoldId);
        Assert.Equal(HoldStatus.Confirmed, state.Hold.Status);
        Assert.Equal(0, state.Class.HeldSeats);
        Assert.Equal(1, state.Class.ConfirmedSeats);
        Assert.NotNull(state.Hold.ConfirmedAt);
        Assert.True(state.Hold.ConfirmedAt!.Value.Offset == TimeSpan.Zero);
    }

    [Fact]
    public async Task ConfirmationIsIdempotentForTheOwner()
    {
        using var client = CreateClient();
        var admissionClass = await CreateClassAsync(client, 1);
        using var createResponse = await CreateHoldAsync(client, admissionClass.Id, "student-confirm-idempotent");
        var created = await ReadRequiredAsync<CreatedHoldResponse>(createResponse);

        using var firstResponse = await SendWithStudentAsync(
            client,
            HttpMethod.Post,
            $"/holds/{created.HoldId}/confirm",
            "student-confirm-idempotent");
        using var secondResponse = await SendWithStudentAsync(
            client,
            HttpMethod.Post,
            $"/holds/{created.HoldId}/confirm",
            "student-confirm-idempotent");

        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, secondResponse.StatusCode);
        Assert.Equal(
            await firstResponse.Content.ReadFromJsonAsync<ConfirmationResponse>(),
            await secondResponse.Content.ReadFromJsonAsync<ConfirmationResponse>());

        var state = await ReadStateAsync(created.ClassId, created.HoldId);
        Assert.Equal(HoldStatus.Confirmed, state.Hold.Status);
        Assert.Equal(0, state.Class.HeldSeats);
        Assert.Equal(1, state.Class.ConfirmedSeats);
    }

    [Fact]
    public async Task RejectsConfirmationFromAnotherStudent()
    {
        using var client = CreateClient();
        var admissionClass = await CreateClassAsync(client, 1);
        using var createResponse = await CreateHoldAsync(client, admissionClass.Id, "student-confirm-owner");
        var created = await ReadRequiredAsync<CreatedHoldResponse>(createResponse);

        using var response = await SendWithStudentAsync(
            client,
            HttpMethod.Post,
            $"/holds/{created.HoldId}/confirm",
            "student-confirm-other");

        await AssertProblemAsync(response, HttpStatusCode.Forbidden, "HOLD_OWNER_FORBIDDEN");
        var state = await ReadStateAsync(created.ClassId, created.HoldId);
        Assert.Equal(HoldStatus.Held, state.Hold.Status);
        Assert.Equal(1, state.Class.HeldSeats);
        Assert.Equal(0, state.Class.ConfirmedSeats);
    }

    [Fact]
    public async Task RejectsCancellationFromAnotherStudent()
    {
        using var client = CreateClient();
        var admissionClass = await CreateClassAsync(client, 1);
        using var createResponse = await CreateHoldAsync(client, admissionClass.Id, "student-cancel-owner");
        var created = await ReadRequiredAsync<CreatedHoldResponse>(createResponse);

        using var response = await SendWithStudentAsync(
            client,
            HttpMethod.Delete,
            $"/holds/{created.HoldId}",
            "student-cancel-other");

        await AssertProblemAsync(response, HttpStatusCode.Forbidden, "HOLD_OWNER_FORBIDDEN");
        var state = await ReadStateAsync(created.ClassId, created.HoldId);
        Assert.Equal(HoldStatus.Held, state.Hold.Status);
        Assert.Equal(1, state.Class.HeldSeats);
        Assert.Equal(0, state.Class.ConfirmedSeats);
    }

    [Fact]
    public async Task RejectsConfirmationAfterExpiryAndReleasesTheSeatOnce()
    {
        var seeded = await SeedClassWithHoldAsync(
            totalSeats: 1,
            heldSeats: 1,
            holdStatus: HoldStatus.Held,
            studentId: "student-confirm-expired",
            expiresIn: TimeSpan.FromMinutes(-1));
        using var client = CreateClient();

        using var response = await SendWithStudentAsync(
            client,
            HttpMethod.Post,
            $"/holds/{seeded.HoldPublicId}/confirm",
            seeded.StudentId);

        await AssertProblemAsync(response, HttpStatusCode.Conflict, "HOLD_EXPIRED");
        var state = await ReadStateAsync(seeded.ClassPublicId, seeded.HoldPublicId);
        Assert.Equal(HoldStatus.Expired, state.Hold.Status);
        Assert.Equal(0, state.Class.HeldSeats);
        Assert.Equal(0, state.Class.ConfirmedSeats);
    }

    [Fact]
    public async Task RejectsConfirmationAfterCancellation()
    {
        using var client = CreateClient();
        var admissionClass = await CreateClassAsync(client, 1);
        using var createResponse = await CreateHoldAsync(client, admissionClass.Id, "student-confirm-cancelled");
        var created = await ReadRequiredAsync<CreatedHoldResponse>(createResponse);

        using var cancelResponse = await SendWithStudentAsync(
            client,
            HttpMethod.Delete,
            $"/holds/{created.HoldId}",
            "student-confirm-cancelled");
        Assert.Equal(HttpStatusCode.NoContent, cancelResponse.StatusCode);

        using var response = await SendWithStudentAsync(
            client,
            HttpMethod.Post,
            $"/holds/{created.HoldId}/confirm",
            "student-confirm-cancelled");

        await AssertProblemAsync(response, HttpStatusCode.Conflict, "HOLD_CANCELLED");
    }

    [Fact]
    public async Task CancelsHeldApplicationAndPreservesHistory()
    {
        using var client = CreateClient();
        var admissionClass = await CreateClassAsync(client, 1);
        using var createResponse = await CreateHoldAsync(client, admissionClass.Id, "student-cancel");
        var created = await ReadRequiredAsync<CreatedHoldResponse>(createResponse);

        using var response = await SendWithStudentAsync(
            client,
            HttpMethod.Delete,
            $"/holds/{created.HoldId}",
            "student-cancel");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var state = await ReadStateAsync(created.ClassId, created.HoldId);
        Assert.Equal(HoldStatus.Cancelled, state.Hold.Status);
        Assert.Equal(0, state.Class.HeldSeats);
        Assert.NotNull(state.Hold.CancelledAt);

        using var historyResponse = await SendWithStudentAsync(
            client,
            HttpMethod.Get,
            "/me/holds",
            "student-cancel");
        var history = await historyResponse.Content.ReadFromJsonAsync<HistoryResponse[]>();

        Assert.Equal(HttpStatusCode.OK, historyResponse.StatusCode);
        var historyItem = Assert.Single(history!);
        Assert.Equal(created.HoldId, historyItem.HoldId);
        Assert.Equal("CANCELLED", historyItem.Status);
    }

    [Fact]
    public async Task CancellationIsIdempotentForTheOwner()
    {
        using var client = CreateClient();
        var admissionClass = await CreateClassAsync(client, 1);
        using var createResponse = await CreateHoldAsync(client, admissionClass.Id, "student-cancel-idempotent");
        var created = await ReadRequiredAsync<CreatedHoldResponse>(createResponse);

        using var firstResponse = await SendWithStudentAsync(
            client,
            HttpMethod.Delete,
            $"/holds/{created.HoldId}",
            "student-cancel-idempotent");
        using var secondResponse = await SendWithStudentAsync(
            client,
            HttpMethod.Delete,
            $"/holds/{created.HoldId}",
            "student-cancel-idempotent");

        Assert.Equal(HttpStatusCode.NoContent, firstResponse.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, secondResponse.StatusCode);
        var state = await ReadStateAsync(created.ClassId, created.HoldId);
        Assert.Equal(HoldStatus.Cancelled, state.Hold.Status);
        Assert.Equal(0, state.Class.HeldSeats);
    }

    [Fact]
    public async Task RejectsCancellationAfterConfirmation()
    {
        using var client = CreateClient();
        var admissionClass = await CreateClassAsync(client, 1);
        using var createResponse = await CreateHoldAsync(client, admissionClass.Id, "student-cancel-confirmed");
        var created = await ReadRequiredAsync<CreatedHoldResponse>(createResponse);
        using var confirmResponse = await SendWithStudentAsync(
            client,
            HttpMethod.Post,
            $"/holds/{created.HoldId}/confirm",
            "student-cancel-confirmed");
        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);

        using var response = await SendWithStudentAsync(
            client,
            HttpMethod.Delete,
            $"/holds/{created.HoldId}",
            "student-cancel-confirmed");

        await AssertProblemAsync(response, HttpStatusCode.Conflict, "CONFIRMED_HOLD_CANNOT_CANCEL");
        var state = await ReadStateAsync(created.ClassId, created.HoldId);
        Assert.Equal(HoldStatus.Confirmed, state.Hold.Status);
        Assert.Equal(1, state.Class.ConfirmedSeats);
    }

    [Fact]
    public async Task RejectsCancellationAfterExpiry()
    {
        var seeded = await SeedClassWithHoldAsync(
            totalSeats: 1,
            heldSeats: 1,
            holdStatus: HoldStatus.Held,
            studentId: "student-cancel-expired",
            expiresIn: TimeSpan.FromMinutes(-1));
        using var client = CreateClient();

        using var response = await SendWithStudentAsync(
            client,
            HttpMethod.Delete,
            $"/holds/{seeded.HoldPublicId}",
            seeded.StudentId);

        await AssertProblemAsync(response, HttpStatusCode.Conflict, "HOLD_EXPIRED");
        var state = await ReadStateAsync(seeded.ClassPublicId, seeded.HoldPublicId);
        Assert.Equal(HoldStatus.Expired, state.Hold.Status);
        Assert.Equal(0, state.Class.HeldSeats);
    }

    [Fact]
    public async Task RequiresStudentIdForConfirmationCancellationAndHistory()
    {
        using var client = CreateClient();
        var admissionClass = await CreateClassAsync(client, 1);
        using var createResponse = await CreateHoldAsync(client, admissionClass.Id, "student-header-required");
        var created = await ReadRequiredAsync<CreatedHoldResponse>(createResponse);

        using var confirmResponse = await client.PostAsync(
            $"/holds/{created.HoldId}/confirm",
            content: null);
        using var cancelResponse = await client.DeleteAsync($"/holds/{created.HoldId}");
        using var historyResponse = await client.GetAsync("/me/holds");

        await AssertProblemAsync(confirmResponse, HttpStatusCode.BadRequest, "STUDENT_ID_REQUIRED");
        await AssertProblemAsync(cancelResponse, HttpStatusCode.BadRequest, "STUDENT_ID_REQUIRED");
        await AssertProblemAsync(historyResponse, HttpStatusCode.BadRequest, "STUDENT_ID_REQUIRED");
    }

    [Fact]
    public async Task RejectsMalformedConfirmationHoldId()
    {
        using var client = CreateClient();

        using var response = await SendWithStudentAsync(
            client,
            HttpMethod.Post,
            "/holds/not-a-hold/confirm",
            "student-malformed-confirm");

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "VALIDATION_ERROR");
    }

    [Fact]
    public async Task ReturnsNotFoundForUnknownConfirmationHoldId()
    {
        using var client = CreateClient();

        using var response = await SendWithStudentAsync(
            client,
            HttpMethod.Post,
            $"/holds/h_{Guid.NewGuid():N}/confirm",
            "student-unknown-confirm");

        await AssertProblemAsync(response, HttpStatusCode.NotFound, "HOLD_NOT_FOUND");
    }

    [Fact]
    public async Task RejectsMalformedCancellationHoldId()
    {
        using var client = CreateClient();

        using var response = await SendWithStudentAsync(
            client,
            HttpMethod.Delete,
            "/holds/not-a-hold",
            "student-malformed-cancel");

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "VALIDATION_ERROR");
    }

    [Fact]
    public async Task ReturnsNotFoundForUnknownCancellationHoldId()
    {
        using var client = CreateClient();

        using var response = await SendWithStudentAsync(
            client,
            HttpMethod.Delete,
            $"/holds/h_{Guid.NewGuid():N}",
            "student-unknown-cancel");

        await AssertProblemAsync(response, HttpStatusCode.NotFound, "HOLD_NOT_FOUND");
    }

    [Fact]
    public async Task ReturnsEmptyHistoryForStudentWithoutApplications()
    {
        using var client = CreateClient();

        using var response = await SendWithStudentAsync(
            client,
            HttpMethod.Get,
            "/me/holds",
            $"student-empty-history-{Guid.NewGuid():N}");
        var history = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(JsonValueKind.Array, history.ValueKind);
        Assert.Empty(history.EnumerateArray());
    }

    [Fact]
    public async Task StudentHistoryIsFilteredAndUsesDocumentedFields()
    {
        var classId = Guid.NewGuid();
        var className = $"History Test Class {Guid.NewGuid():N}";
        var now = DateTimeOffset.UtcNow;
        var admissionClass = new AdmissionClass
        {
            Id = classId,
            Name = className,
            TotalSeats = 3,
            CreatedAt = now.AddMinutes(-30)
        };
        var older = CreateSeededHold(
            classId,
            "student-history-a",
            HoldStatus.Cancelled,
            now.AddMinutes(-20),
            now.AddMinutes(-10));
        var newer = CreateSeededHold(
            classId,
            "student-history-a",
            HoldStatus.Expired,
            now.AddMinutes(-15),
            now.AddMinutes(-5));
        var otherStudent = CreateSeededHold(
            classId,
            "student-history-b",
            HoldStatus.Confirmed,
            now.AddMinutes(-10),
            now.AddMinutes(10));

        await using (var dbContext = fixture.CreateDbContext())
        {
            admissionClass.ConfirmedSeats = 1;
            dbContext.AdmissionClasses.Add(admissionClass);
            dbContext.AdmissionHolds.AddRange(older, newer, otherStudent);
            await dbContext.SaveChangesAsync();
        }

        using var client = CreateClient();
        using var response = await SendWithStudentAsync(
            client,
            HttpMethod.Get,
            "/me/holds",
            "  student-history-a  ");
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(JsonValueKind.Array, body.ValueKind);
        Assert.Equal(2, body.GetArrayLength());
        var items = body.EnumerateArray().ToArray();
        Assert.Equal(HoldIdCodec( newer.Id), items[0].GetProperty("holdId").GetString());
        Assert.Equal("EXPIRED", items[0].GetProperty("status").GetString());
        Assert.Equal(HoldIdCodec(older.Id), items[1].GetProperty("holdId").GetString());
        Assert.Equal("CANCELLED", items[1].GetProperty("status").GetString());
        Assert.Equal(className, items[0].GetProperty("className").GetString());
        Assert.DoesNotContain(items[0].EnumerateObject(), property =>
            string.Equals(property.Name, "studentId", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(items[1].EnumerateObject(), property =>
            string.Equals(property.Name, "studentId", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(
            items,
            item => item.GetProperty("holdId").GetString() == HoldIdCodec(otherStudent.Id));
    }

    [Fact]
    public async Task ConcurrentConfirmationConfirmsOnce()
    {
        using var setupClient = CreateClient();
        var admissionClass = await CreateClassAsync(setupClient, 1);
        using var createResponse = await CreateHoldAsync(
            setupClient,
            admissionClass.Id,
            "student-concurrent-confirm");
        var created = await ReadRequiredAsync<CreatedHoldResponse>(createResponse);
        using var firstClient = CreateClient();
        using var secondClient = CreateClient();

        var firstTask = SendWithStudentAsync(
            firstClient,
            HttpMethod.Post,
            $"/holds/{created.HoldId}/confirm",
            "student-concurrent-confirm");
        var secondTask = SendWithStudentAsync(
            secondClient,
            HttpMethod.Post,
            $"/holds/{created.HoldId}/confirm",
            "student-concurrent-confirm");
        await Task.WhenAll(firstTask, secondTask);

        using var firstResponse = await firstTask;
        using var secondResponse = await secondTask;
        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, secondResponse.StatusCode);

        var state = await ReadStateAsync(created.ClassId, created.HoldId);
        Assert.Equal(HoldStatus.Confirmed, state.Hold.Status);
        Assert.Equal(0, state.Class.HeldSeats);
        Assert.Equal(1, state.Class.ConfirmedSeats);
    }

    [Fact]
    public async Task ConcurrentCancellationReleasesOnce()
    {
        using var setupClient = CreateClient();
        var admissionClass = await CreateClassAsync(setupClient, 1);
        using var createResponse = await CreateHoldAsync(
            setupClient,
            admissionClass.Id,
            "student-concurrent-cancel");
        var created = await ReadRequiredAsync<CreatedHoldResponse>(createResponse);
        using var firstClient = CreateClient();
        using var secondClient = CreateClient();

        var firstTask = SendWithStudentAsync(
            firstClient,
            HttpMethod.Delete,
            $"/holds/{created.HoldId}",
            "student-concurrent-cancel");
        var secondTask = SendWithStudentAsync(
            secondClient,
            HttpMethod.Delete,
            $"/holds/{created.HoldId}",
            "student-concurrent-cancel");
        await Task.WhenAll(firstTask, secondTask);

        using var firstResponse = await firstTask;
        using var secondResponse = await secondTask;
        Assert.Equal(HttpStatusCode.NoContent, firstResponse.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, secondResponse.StatusCode);

        var state = await ReadStateAsync(created.ClassId, created.HoldId);
        Assert.Equal(HoldStatus.Cancelled, state.Hold.Status);
        Assert.Equal(0, state.Class.HeldSeats);
        Assert.Equal(0, state.Class.ConfirmedSeats);
    }

    [Fact]
    public async Task ConfirmationAndCancellationRaceLeavesOneConsistentTerminalState()
    {
        using var setupClient = CreateClient();
        var admissionClass = await CreateClassAsync(setupClient, 1);
        using var createResponse = await CreateHoldAsync(
            setupClient,
            admissionClass.Id,
            "student-confirm-cancel-race");
        var created = await ReadRequiredAsync<CreatedHoldResponse>(createResponse);
        using var confirmClient = CreateClient();
        using var cancelClient = CreateClient();

        var confirmationTask = SendWithStudentAsync(
            confirmClient,
            HttpMethod.Post,
            $"/holds/{created.HoldId}/confirm",
            "student-confirm-cancel-race");
        var cancellationTask = SendWithStudentAsync(
            cancelClient,
            HttpMethod.Delete,
            $"/holds/{created.HoldId}",
            "student-confirm-cancel-race");
        await Task.WhenAll(confirmationTask, cancellationTask);

        using var confirmationResponse = await confirmationTask;
        using var cancellationResponse = await cancellationTask;
        var statuses = new[] { confirmationResponse.StatusCode, cancellationResponse.StatusCode };
        Assert.Contains(statuses, status => status is HttpStatusCode.OK or HttpStatusCode.NoContent);
        Assert.Contains(statuses, status => status is HttpStatusCode.NoContent or HttpStatusCode.Conflict);
        Assert.DoesNotContain(HttpStatusCode.InternalServerError, statuses);

        var state = await ReadStateAsync(created.ClassId, created.HoldId);
        Assert.Equal(0, state.Class.HeldSeats);
        if (state.Hold.Status == HoldStatus.Confirmed)
        {
            Assert.Equal(1, state.Class.ConfirmedSeats);
            Assert.Equal(HttpStatusCode.Conflict, cancellationResponse.StatusCode);
        }
        else
        {
            Assert.Equal(HoldStatus.Cancelled, state.Hold.Status);
            Assert.Equal(0, state.Class.ConfirmedSeats);
            Assert.Equal(HttpStatusCode.NoContent, cancellationResponse.StatusCode);
        }
    }

    [Fact]
    public async Task FailedMutationRollsBackExpiryAndCounterChanges()
    {
        var seeded = await SeedClassWithHoldAsync(
            totalSeats: 1,
            heldSeats: 0,
            holdStatus: HoldStatus.Held,
            studentId: "student-rollback",
            expiresIn: TimeSpan.FromMinutes(-1));
        using var client = CreateClient();

        using var response = await SendWithStudentAsync(
            client,
            HttpMethod.Post,
            $"/holds/{seeded.HoldPublicId}/confirm",
            seeded.StudentId);

        await AssertProblemAsync(response, HttpStatusCode.InternalServerError, "INTERNAL_ERROR");
        var state = await ReadStateAsync(seeded.ClassPublicId, seeded.HoldPublicId);
        Assert.Equal(HoldStatus.Held, state.Hold.Status);
        Assert.Equal(0, state.Class.HeldSeats);
        Assert.Equal(0, state.Class.ConfirmedSeats);
    }

    private HttpClient CreateClient() => factory.CreateClient();

    private static async Task<ClassResponse> CreateClassAsync(HttpClient client, int totalSeats)
    {
        using var response = await client.PostAsJsonAsync(
            "/classes",
            new CreateClassRequest($"Lifecycle Test Class {Guid.NewGuid():N}", totalSeats));
        response.EnsureSuccessStatusCode();
        return await ReadRequiredAsync<ClassResponse>(response);
    }

    private static async Task<HttpResponseMessage> CreateHoldAsync(
        HttpClient client,
        string classId,
        string studentId)
    {
        return await SendWithStudentAsync(
            client,
            HttpMethod.Post,
            $"/classes/{classId}/holds",
            studentId);
    }

    private static async Task<HttpResponseMessage> SendWithStudentAsync(
        HttpClient client,
        HttpMethod method,
        string path,
        string? studentId)
    {
        using var request = new HttpRequestMessage(method, path);
        if (studentId is not null)
        {
            request.Headers.TryAddWithoutValidation("X-Student-Id", studentId);
        }

        return await client.SendAsync(request);
    }

    private async Task<(AdmissionClass Class, AdmissionHold Hold)> ReadStateAsync(
        string classPublicId,
        string holdPublicId)
    {
        var classId = Guid.ParseExact(classPublicId[2..], "N");
        var holdId = Guid.ParseExact(holdPublicId[2..], "N");
        await using var dbContext = fixture.CreateDbContext();
        var admissionClass = await dbContext.AdmissionClasses
            .AsNoTracking()
            .SingleAsync(item => item.Id == classId);
        var hold = await dbContext.AdmissionHolds
            .AsNoTracking()
            .SingleAsync(item => item.Id == holdId);
        return (admissionClass, hold);
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
            Name = $"Seeded Lifecycle Class {Guid.NewGuid():N}",
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

    private static AdmissionHold CreateSeededHold(
        Guid classId,
        string studentId,
        HoldStatus status,
        DateTimeOffset createdAt,
        DateTimeOffset expiresAt) => new()
        {
            Id = Guid.NewGuid(),
            ClassId = classId,
            StudentId = studentId,
            Status = status,
            CreatedAt = createdAt,
            ExpiresAt = expiresAt
        };

    private static async Task<T> ReadRequiredAsync<T>(HttpResponseMessage response)
    {
        var value = await response.Content.ReadFromJsonAsync<T>();
        Assert.NotNull(value);
        return value!;
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

    private sealed record CreateClassRequest(string Name, int TotalSeats);

    private sealed record ClassResponse(
        string Id,
        string Name,
        int TotalSeats,
        int HeldSeats = 0,
        int ConfirmedSeats = 0,
        int AvailableSeats = 0);

    private sealed record CreatedHoldResponse(
        string HoldId,
        string ClassId,
        string StudentId,
        string Status,
        DateTimeOffset ExpiresAt);

    private sealed record ConfirmationResponse(string HoldId, string Status);

    private sealed record HistoryResponse(
        string HoldId,
        string ClassId,
        string ClassName,
        string Status,
        DateTimeOffset ExpiresAt);

    private sealed record ProblemResponse(string? Code);

    private sealed record SeededHold(
        string ClassPublicId,
        Guid ClassId,
        Guid HoldId,
        string HoldPublicId,
        string StudentId);
}
