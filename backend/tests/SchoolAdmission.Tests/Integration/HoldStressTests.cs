#if STRESS_TESTS
using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Domain.Enums;
using SchoolAdmission.Infrastructure.Persistence;

namespace SchoolAdmission.Tests.Integration;

[Collection(PostgresDatabaseCollectionDefinition.Name)]
public sealed class HoldStressTests(PostgresFixture fixture)
{
    [Fact]
    public async Task OneHundredTwentySeatsAcceptExactlyOneHundredTwentyConcurrentRequests()
    {
        using var factory = new SchoolAdmissionApiFactory(fixture.ConnectionString);
        using var client = factory.CreateClient();
        using var classResponse = await client.PostAsJsonAsync(
            "/classes",
            new CreateClassRequest($"Stress Test Class {Guid.NewGuid():N}", 120));
        classResponse.EnsureSuccessStatusCode();
        var admissionClass = await classResponse.Content.ReadFromJsonAsync<ClassResponse>();
        Assert.NotNull(admissionClass);

        var startGate = new TaskCompletionSource(
            TaskCreationOptions.RunContinuationsAsynchronously);
        var requests = Enumerable.Range(0, 1_000)
            .Select(studentNumber => SubmitHoldAsync(
                client,
                admissionClass!.Id,
                $"stress-student-{studentNumber}",
                startGate.Task))
            .ToArray();

        startGate.SetResult();
        var results = await Task.WhenAll(requests);

        var successfulReservations = results.Count(result => result.StatusCode == HttpStatusCode.Created);
        var rejectedReservations = results.Count(result => result.StatusCode == HttpStatusCode.Conflict);

        Assert.Equal(120, successfulReservations);
        Assert.Equal(880, rejectedReservations);
        Assert.All(
            results.Where(result => result.StatusCode == HttpStatusCode.Conflict),
            result => Assert.Equal("NO_SEATS_AVAILABLE", result.ErrorCode));

        var classId = Guid.ParseExact(admissionClass.Id[2..], "N");
        await using var dbContext = fixture.CreateDbContext();
        var persistedClass = await dbContext.AdmissionClasses
            .AsNoTracking()
            .SingleAsync(item => item.Id == classId);
        var persistedHolds = await dbContext.AdmissionHolds
            .AsNoTracking()
            .Where(item => item.ClassId == classId)
            .ToListAsync();

        Assert.Equal(120, persistedClass.HeldSeats);
        Assert.Equal(0, persistedClass.ConfirmedSeats);
        Assert.Equal(120, persistedHolds.Count);
        Assert.All(persistedHolds, hold => Assert.Equal(HoldStatus.Held, hold.Status));
        Assert.Equal(120, persistedHolds.Select(hold => hold.StudentId).Distinct(StringComparer.Ordinal).Count());
    }

    private static async Task<StressResult> SubmitHoldAsync(
        HttpClient client,
        string classId,
        string studentId,
        Task startTask)
    {
        await startTask;
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        request.Headers.TryAddWithoutValidation("X-Student-Id", studentId);
        using var response = await client.SendAsync(request);
        string? errorCode = null;

        if (response.StatusCode == HttpStatusCode.Conflict)
        {
            var problem = await response.Content.ReadFromJsonAsync<ProblemResponse>();
            errorCode = problem?.Code;
        }

        return new StressResult(response.StatusCode, errorCode);
    }

    private sealed record CreateClassRequest(string Name, int TotalSeats);

    private sealed record ClassResponse(string Id);

    private sealed record ProblemResponse(string? Code);

    private sealed record StressResult(HttpStatusCode StatusCode, string? ErrorCode);
}
#endif
