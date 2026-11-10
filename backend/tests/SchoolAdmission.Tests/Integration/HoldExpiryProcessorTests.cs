using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using SchoolAdmission.Api.Workers;
using SchoolAdmission.Application.Reservations;
using SchoolAdmission.Domain.Entities;
using SchoolAdmission.Domain.Enums;
using SchoolAdmission.Infrastructure.Persistence;
using SchoolAdmission.Infrastructure.Persistence.Repositories;

namespace SchoolAdmission.Tests.Integration;

[Collection(PostgresDatabaseCollectionDefinition.Name)]
public sealed class HoldExpiryProcessorTests(PostgresFixture fixture) : IAsyncLifetime
{
    private readonly PostgresFixture fixture = fixture;

    public async Task InitializeAsync()
    {
        await using var dbContext = fixture.CreateDbContext();
        await dbContext.Database.ExecuteSqlRawAsync(
            "TRUNCATE TABLE admission_holds, admission_classes;");
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task ExpiresDueHeldApplicationAndReleasesItsSeatOnce()
    {
        var seeded = await SeedClassWithHoldsAsync(
            totalSeats: 1,
            heldSeats: 1,
            confirmedSeats: 0,
            ("expiry-once", HoldStatus.Held, TimeSpan.FromMinutes(-1)));

        var firstCount = await ProcessBatchAsync(DateTimeOffset.UtcNow, 100);
        var secondCount = await ProcessBatchAsync(DateTimeOffset.UtcNow, 100);
        var state = await ReadStateAsync(seeded.ClassId, seeded.Holds.Single().Id);

        Assert.Equal(1, firstCount);
        Assert.Equal(0, secondCount);
        Assert.Equal(HoldStatus.Expired, state.Hold.Status);
        Assert.Equal(0, state.Class.HeldSeats);
        Assert.Equal(0, state.Class.ConfirmedSeats);
    }

    [Fact]
    public async Task LeavesFutureConfirmedAndCancelledApplicationsUnchanged()
    {
        var seeded = await SeedClassWithHoldsAsync(
            totalSeats: 4,
            heldSeats: 2,
            confirmedSeats: 1,
            ("expiry-future", HoldStatus.Held, TimeSpan.FromMinutes(10)),
            ("expiry-due", HoldStatus.Held, TimeSpan.FromMinutes(-1)),
            ("expiry-confirmed", HoldStatus.Confirmed, TimeSpan.FromMinutes(10)),
            ("expiry-cancelled", HoldStatus.Cancelled, TimeSpan.FromMinutes(10)));

        var expiredCount = await ProcessBatchAsync(DateTimeOffset.UtcNow, 100);
        await using var dbContext = fixture.CreateDbContext();
        var holds = await dbContext.AdmissionHolds
            .AsNoTracking()
            .Where(hold => hold.ClassId == seeded.ClassId)
            .ToDictionaryAsync(hold => hold.StudentId);
        var admissionClass = await dbContext.AdmissionClasses
            .AsNoTracking()
            .SingleAsync(admissionClass => admissionClass.Id == seeded.ClassId);

        Assert.Equal(1, expiredCount);
        Assert.Equal(HoldStatus.Held, holds["expiry-future"].Status);
        Assert.Equal(HoldStatus.Expired, holds["expiry-due"].Status);
        Assert.Equal(HoldStatus.Confirmed, holds["expiry-confirmed"].Status);
        Assert.Equal(HoldStatus.Cancelled, holds["expiry-cancelled"].Status);
        Assert.Equal(1, admissionClass.HeldSeats);
        Assert.Equal(1, admissionClass.ConfirmedSeats);
    }

    [Fact]
    public async Task RespectsBatchSizeAcrossMultipleBatches()
    {
        var seeded = await SeedClassWithHoldsAsync(
            totalSeats: 5,
            heldSeats: 5,
            confirmedSeats: 0,
            ("expiry-batch-1", HoldStatus.Held, TimeSpan.FromMinutes(-5)),
            ("expiry-batch-2", HoldStatus.Held, TimeSpan.FromMinutes(-4)),
            ("expiry-batch-3", HoldStatus.Held, TimeSpan.FromMinutes(-3)),
            ("expiry-batch-4", HoldStatus.Held, TimeSpan.FromMinutes(-2)),
            ("expiry-batch-5", HoldStatus.Held, TimeSpan.FromMinutes(-1)));

        var firstCount = await ProcessBatchAsync(DateTimeOffset.UtcNow, 2);
        var secondCount = await ProcessBatchAsync(DateTimeOffset.UtcNow, 2);
        var thirdCount = await ProcessBatchAsync(DateTimeOffset.UtcNow, 2);

        await using var dbContext = fixture.CreateDbContext();
        var admissionClass = await dbContext.AdmissionClasses
            .AsNoTracking()
            .SingleAsync(admissionClass => admissionClass.Id == seeded.ClassId);
        var expiredCount = await dbContext.AdmissionHolds
            .CountAsync(hold => hold.ClassId == seeded.ClassId && hold.Status == HoldStatus.Expired);

        Assert.Equal(2, firstCount);
        Assert.Equal(2, secondCount);
        Assert.Equal(1, thirdCount);
        Assert.Equal(5, expiredCount);
        Assert.Equal(0, admissionClass.HeldSeats);
    }

    [Fact]
    public async Task ProcessesDueApplicationsFromMultipleClasses()
    {
        var firstClass = await SeedClassWithHoldsAsync(
            totalSeats: 1,
            heldSeats: 1,
            confirmedSeats: 0,
            ("expiry-class-a", HoldStatus.Held, TimeSpan.FromMinutes(-1)));
        var secondClass = await SeedClassWithHoldsAsync(
            totalSeats: 1,
            heldSeats: 1,
            confirmedSeats: 0,
            ("expiry-class-b", HoldStatus.Held, TimeSpan.FromMinutes(-1)));

        var expiredCount = await ProcessBatchAsync(DateTimeOffset.UtcNow, 100);
        await using var dbContext = fixture.CreateDbContext();
        var expiredHolds = await dbContext.AdmissionHolds
            .CountAsync(hold =>
                (hold.ClassId == firstClass.ClassId || hold.ClassId == secondClass.ClassId)
                && hold.Status == HoldStatus.Expired);

        Assert.Equal(2, expiredCount);
        Assert.Equal(2, expiredHolds);
    }

    [Fact]
    public async Task ConcurrentExpiryProcessorsReleaseASeatOnlyOnce()
    {
        var seeded = await SeedClassWithHoldsAsync(
            totalSeats: 1,
            heldSeats: 1,
            confirmedSeats: 0,
            ("expiry-concurrent", HoldStatus.Held, TimeSpan.FromMinutes(-1)));
        var currentUtcTime = DateTimeOffset.UtcNow;

        var results = await Task.WhenAll(
            ProcessBatchAsync(currentUtcTime, 1),
            ProcessBatchAsync(currentUtcTime, 1));

        await using var dbContext = fixture.CreateDbContext();
        var admissionClass = await dbContext.AdmissionClasses
            .AsNoTracking()
            .SingleAsync(admissionClass => admissionClass.Id == seeded.ClassId);
        var hold = await dbContext.AdmissionHolds
            .AsNoTracking()
            .SingleAsync(hold => hold.Id == seeded.Holds.Single().Id);

        Assert.Equal(1, results.Sum());
        Assert.Equal(HoldStatus.Expired, hold.Status);
        Assert.Equal(0, admissionClass.HeldSeats);
        Assert.Equal(0, admissionClass.ConfirmedSeats);
    }

    [Fact]
    public async Task ExpiryAndNewReservationRemainConsistentWhenRacing()
    {
        var seeded = await SeedClassWithHoldsAsync(
            totalSeats: 1,
            heldSeats: 1,
            confirmedSeats: 0,
            ("expiry-reservation-old", HoldStatus.Held, TimeSpan.FromMinutes(-1)));
        var currentUtcTime = DateTimeOffset.UtcNow;

        var expiryTask = ProcessBatchAsync(currentUtcTime, 100);
        var reservationTask = CreateReservationAsync(
            seeded.ClassId,
            "expiry-reservation-new",
            currentUtcTime);
        await Task.WhenAll(expiryTask, reservationTask);

        var reservation = await reservationTask;
        await using var dbContext = fixture.CreateDbContext();
        var admissionClass = await dbContext.AdmissionClasses
            .AsNoTracking()
            .SingleAsync(admissionClass => admissionClass.Id == seeded.ClassId);
        var holds = await dbContext.AdmissionHolds
            .AsNoTracking()
            .Where(hold => hold.ClassId == seeded.ClassId)
            .ToListAsync();

        Assert.True(reservation.IsSuccess);
        Assert.Equal(2, holds.Count);
        Assert.Contains(holds, hold => hold.StudentId == "expiry-reservation-old" && hold.Status == HoldStatus.Expired);
        Assert.Contains(holds, hold => hold.StudentId == "expiry-reservation-new" && hold.Status == HoldStatus.Held);
        Assert.Equal(1, admissionClass.HeldSeats);
        Assert.Equal(0, admissionClass.ConfirmedSeats);
    }

    [Fact]
    public async Task ExpiryAndConfirmationRemainConsistentWhenRacing()
    {
        var seeded = await SeedClassWithHoldsAsync(
            totalSeats: 1,
            heldSeats: 1,
            confirmedSeats: 0,
            ("expiry-confirmation-race", HoldStatus.Held, TimeSpan.FromMinutes(-1)));
        var currentUtcTime = DateTimeOffset.UtcNow;

        var expiryTask = ProcessBatchAsync(currentUtcTime, 100);
        var confirmationTask = ConfirmAsync(
            seeded.Holds.Single().Id,
            "expiry-confirmation-race",
            currentUtcTime);
        await Task.WhenAll(expiryTask, confirmationTask);

        var confirmation = await confirmationTask;
        var state = await ReadStateAsync(seeded.ClassId, seeded.Holds.Single().Id);

        Assert.False(confirmation.IsSuccess);
        Assert.Equal(HoldMutationFailure.Expired, confirmation.Failure);
        Assert.Equal(HoldStatus.Expired, state.Hold.Status);
        Assert.Equal(0, state.Class.HeldSeats);
        Assert.Equal(0, state.Class.ConfirmedSeats);
    }

    [Fact]
    public async Task ExpiryAndCancellationRemainConsistentWhenRacing()
    {
        var seeded = await SeedClassWithHoldsAsync(
            totalSeats: 1,
            heldSeats: 1,
            confirmedSeats: 0,
            ("expiry-cancellation-race", HoldStatus.Held, TimeSpan.FromMinutes(-1)));
        var currentUtcTime = DateTimeOffset.UtcNow;

        var expiryTask = ProcessBatchAsync(currentUtcTime, 100);
        var cancellationTask = CancelAsync(
            seeded.Holds.Single().Id,
            "expiry-cancellation-race",
            currentUtcTime);
        await Task.WhenAll(expiryTask, cancellationTask);

        var cancellation = await cancellationTask;
        var state = await ReadStateAsync(seeded.ClassId, seeded.Holds.Single().Id);

        Assert.False(cancellation.IsSuccess);
        Assert.Equal(HoldMutationFailure.Expired, cancellation.Failure);
        Assert.Equal(HoldStatus.Expired, state.Hold.Status);
        Assert.Equal(0, state.Class.HeldSeats);
        Assert.Equal(0, state.Class.ConfirmedSeats);
    }

    [Fact]
    public async Task FailedExpiryTransactionRollsBackStateAndCounters()
    {
        var seeded = await SeedClassWithHoldsAsync(
            totalSeats: 1,
            heldSeats: 0,
            confirmedSeats: 0,
            ("expiry-rollback", HoldStatus.Held, TimeSpan.FromMinutes(-1)));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            ProcessBatchAsync(DateTimeOffset.UtcNow, 100));

        var state = await ReadStateAsync(seeded.ClassId, seeded.Holds.Single().Id);
        Assert.Equal(HoldStatus.Held, state.Hold.Status);
        Assert.Equal(0, state.Class.HeldSeats);
        Assert.Equal(0, state.Class.ConfirmedSeats);
    }

    [Fact]
    public async Task HostedWorkerExpiresOverdueHoldWithoutAnHttpRequest()
    {
        var seeded = await SeedClassWithHoldsAsync(
            totalSeats: 1,
            heldSeats: 1,
            confirmedSeats: 0,
            ("expiry-hosted-worker", HoldStatus.Held, TimeSpan.FromMinutes(-1)));
        using var factory = new SchoolAdmissionApiFactory(
            fixture.ConnectionString,
            new Dictionary<string, string?>
            {
                ["HOLD_EXPIRY_POLL_INTERVAL_SECONDS"] = "1",
                ["HOLD_EXPIRY_BATCH_SIZE"] = "10"
            });
        using var client = factory.CreateClient();

        await WaitUntilAsync(async () =>
        {
            var state = await ReadStateAsync(seeded.ClassId, seeded.Holds.Single().Id);
            return state.Hold.Status == HoldStatus.Expired;
        });

        var finalState = await ReadStateAsync(seeded.ClassId, seeded.Holds.Single().Id);
        Assert.Equal(HoldStatus.Expired, finalState.Hold.Status);
        Assert.Equal(0, finalState.Class.HeldSeats);
        Assert.Equal(0, finalState.Class.ConfirmedSeats);
    }

    [Fact]
    public void HostedWorkerStopsGracefully()
    {
        using var factory = new SchoolAdmissionApiFactory(
            fixture.ConnectionString,
            new Dictionary<string, string?>
            {
                ["HOLD_EXPIRY_POLL_INTERVAL_SECONDS"] = "1"
            });
        using var client = factory.CreateClient();
    }

    private async Task<int> ProcessBatchAsync(DateTimeOffset currentUtcTime, int batchSize)
    {
        await using var dbContext = fixture.CreateDbContext();
        var repository = new EfAdmissionHoldRepository(dbContext);
        var service = new HoldExpiryService(repository);
        return await service.ExpireDueBatchAsync(currentUtcTime, batchSize, CancellationToken.None);
    }

    private async Task<HoldMutationResult> ConfirmAsync(
        Guid holdId,
        string studentId,
        DateTimeOffset currentUtcTime)
    {
        await using var dbContext = fixture.CreateDbContext();
        var repository = new EfAdmissionHoldRepository(dbContext);
        return await repository.ConfirmAsync(holdId, studentId, currentUtcTime, CancellationToken.None);
    }

    private async Task<HoldMutationResult> CancelAsync(
        Guid holdId,
        string studentId,
        DateTimeOffset currentUtcTime)
    {
        await using var dbContext = fixture.CreateDbContext();
        var repository = new EfAdmissionHoldRepository(dbContext);
        return await repository.CancelAsync(holdId, studentId, currentUtcTime, CancellationToken.None);
    }

    private async Task<HoldReservationResult> CreateReservationAsync(
        Guid classId,
        string studentId,
        DateTimeOffset createdAt)
    {
        await using var dbContext = fixture.CreateDbContext();
        var repository = new EfAdmissionHoldRepository(dbContext);
        return await repository.CreateHeldAsync(
            classId,
            studentId,
            createdAt,
            TimeSpan.FromMinutes(10),
            CancellationToken.None);
    }

    private async Task<SeededClass> SeedClassWithHoldsAsync(
        int totalSeats,
        int heldSeats,
        int confirmedSeats,
        params (string StudentId, HoldStatus Status, TimeSpan ExpiresIn)[] specifications)
    {
        var now = DateTimeOffset.UtcNow;
        var admissionClass = new AdmissionClass
        {
            Id = Guid.NewGuid(),
            Name = $"Expiry Test Class {Guid.NewGuid():N}",
            TotalSeats = totalSeats,
            HeldSeats = heldSeats,
            ConfirmedSeats = confirmedSeats,
            CreatedAt = now.AddMinutes(-30)
        };
        var holds = specifications
            .Select(spec =>
            {
                var expiresAt = now.Add(spec.ExpiresIn);
                return new AdmissionHold
                {
                    Id = Guid.NewGuid(),
                    ClassId = admissionClass.Id,
                    StudentId = spec.StudentId,
                    Status = spec.Status,
                    CreatedAt = expiresAt.AddMinutes(-10),
                    ExpiresAt = expiresAt
                };
            })
            .ToArray();

        await using var dbContext = fixture.CreateDbContext();
        dbContext.AdmissionClasses.Add(admissionClass);
        dbContext.AdmissionHolds.AddRange(holds);
        await dbContext.SaveChangesAsync();
        return new SeededClass(admissionClass.Id, holds);
    }

    private async Task<(AdmissionClass Class, AdmissionHold Hold)> ReadStateAsync(
        Guid classId,
        Guid holdId)
    {
        await using var dbContext = fixture.CreateDbContext();
        var admissionClass = await dbContext.AdmissionClasses
            .AsNoTracking()
            .SingleAsync(admissionClass => admissionClass.Id == classId);
        var hold = await dbContext.AdmissionHolds
            .AsNoTracking()
            .SingleAsync(hold => hold.Id == holdId);
        return (admissionClass, hold);
    }

    private static async Task WaitUntilAsync(Func<Task<bool>> condition)
    {
        var timeout = DateTimeOffset.UtcNow.AddSeconds(10);
        while (DateTimeOffset.UtcNow < timeout)
        {
            if (await condition())
            {
                return;
            }

            await Task.Delay(100);
        }

        Assert.Fail("The expected background expiry state was not observed before the timeout.");
    }

    private sealed record SeededClass(Guid ClassId, IReadOnlyList<AdmissionHold> Holds);
}
