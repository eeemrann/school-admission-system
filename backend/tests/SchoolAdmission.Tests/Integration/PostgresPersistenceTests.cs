using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Domain.Entities;
using SchoolAdmission.Domain.Enums;

namespace SchoolAdmission.Tests.Integration;

[Collection(PostgresDatabaseCollectionDefinition.Name)]
public sealed class PostgresPersistenceTests(PostgresFixture fixture)
{
    [Fact]
    public async Task CanConnectToPostgres()
    {
        await using var dbContext = fixture.CreateDbContext();

        Assert.True(await dbContext.Database.CanConnectAsync());
    }

    [Fact]
    public async Task InitialMigrationIsApplied()
    {
        await using var dbContext = fixture.CreateDbContext();

        Assert.Empty(await dbContext.Database.GetPendingMigrationsAsync());
    }

    [Fact]
    public async Task CanCreateAdmissionClass()
    {
        var admissionClass = CreateAdmissionClass();

        await using (var dbContext = fixture.CreateDbContext())
        {
            dbContext.AdmissionClasses.Add(admissionClass);
            await dbContext.SaveChangesAsync();
        }

        await using var verificationContext = fixture.CreateDbContext();
        var persistedClass = await verificationContext.AdmissionClasses.SingleAsync(entity => entity.Id == admissionClass.Id);

        Assert.Equal(admissionClass.Name, persistedClass.Name);
        Assert.Equal(admissionClass.TotalSeats, persistedClass.TotalSeats);
    }

    [Fact]
    public async Task CanCreateAdmissionHold()
    {
        var admissionClass = CreateAdmissionClass();
        var admissionHold = CreateAdmissionHold(admissionClass.Id, "student-create");

        await using var dbContext = fixture.CreateDbContext();
        dbContext.AdmissionClasses.Add(admissionClass);
        dbContext.AdmissionHolds.Add(admissionHold);
        await dbContext.SaveChangesAsync();

        var persistedHold = await dbContext.AdmissionHolds.SingleAsync(entity => entity.Id == admissionHold.Id);

        Assert.Equal(HoldStatus.Held, persistedHold.Status);
        Assert.Equal(admissionClass.Id, persistedHold.ClassId);
    }

    [Fact]
    public async Task AdmissionHoldReferencesItsAdmissionClass()
    {
        var admissionClass = CreateAdmissionClass();
        var admissionHold = CreateAdmissionHold(admissionClass.Id, "student-relation");

        await using var dbContext = fixture.CreateDbContext();
        dbContext.AdmissionClasses.Add(admissionClass);
        dbContext.AdmissionHolds.Add(admissionHold);
        await dbContext.SaveChangesAsync();

        Assert.True(await dbContext.AdmissionClasses.AnyAsync(entity => entity.Id == admissionHold.ClassId));
    }

    [Fact]
    public async Task RejectsSeatCapacityViolations()
    {
        await using var dbContext = fixture.CreateDbContext();
        dbContext.AdmissionClasses.Add(CreateAdmissionClass(totalSeats: 1, heldSeats: 1, confirmedSeats: 1));

        await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
    }

    [Fact]
    public async Task RejectsNegativeSeatCounters()
    {
        await using var dbContext = fixture.CreateDbContext();
        dbContext.AdmissionClasses.Add(CreateAdmissionClass(heldSeats: -1));

        await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
    }

    [Fact]
    public async Task PartialUniqueIndexRejectsDuplicateActiveHolds()
    {
        var admissionClass = CreateAdmissionClass();
        var firstHold = CreateAdmissionHold(admissionClass.Id, "student-duplicate");

        await using (var firstContext = fixture.CreateDbContext())
        {
            firstContext.AdmissionClasses.Add(admissionClass);
            firstContext.AdmissionHolds.Add(firstHold);
            await firstContext.SaveChangesAsync();
        }

        await using var duplicateContext = fixture.CreateDbContext();
        duplicateContext.AdmissionHolds.Add(CreateAdmissionHold(admissionClass.Id, firstHold.StudentId));

        await Assert.ThrowsAsync<DbUpdateException>(() => duplicateContext.SaveChangesAsync());
    }

    [Fact]
    public async Task AllowsNewHoldAfterExpiredHold()
    {
        var admissionClass = CreateAdmissionClass();
        var expiredHold = CreateAdmissionHold(admissionClass.Id, "student-expired", HoldStatus.Expired);

        await using var dbContext = fixture.CreateDbContext();
        dbContext.AdmissionClasses.Add(admissionClass);
        dbContext.AdmissionHolds.Add(expiredHold);
        dbContext.AdmissionHolds.Add(CreateAdmissionHold(admissionClass.Id, expiredHold.StudentId));

        await dbContext.SaveChangesAsync();

        Assert.Equal(2, await dbContext.AdmissionHolds.CountAsync(entity => entity.ClassId == admissionClass.Id));
    }

    [Fact]
    public async Task AllowsNewHoldAfterCancelledHold()
    {
        var admissionClass = CreateAdmissionClass();
        var cancelledHold = CreateAdmissionHold(admissionClass.Id, "student-cancelled", HoldStatus.Cancelled);

        await using var dbContext = fixture.CreateDbContext();
        dbContext.AdmissionClasses.Add(admissionClass);
        dbContext.AdmissionHolds.Add(cancelledHold);
        dbContext.AdmissionHolds.Add(CreateAdmissionHold(admissionClass.Id, cancelledHold.StudentId));

        await dbContext.SaveChangesAsync();

        Assert.Equal(2, await dbContext.AdmissionHolds.CountAsync(entity => entity.ClassId == admissionClass.Id));
    }

    [Fact]
    public async Task PersistsAcrossDbContextInstances()
    {
        var admissionClass = CreateAdmissionClass();

        await using (var writeContext = fixture.CreateDbContext())
        {
            writeContext.AdmissionClasses.Add(admissionClass);
            await writeContext.SaveChangesAsync();
        }

        await using var readContext = fixture.CreateDbContext();
        var persistedClass = await readContext.AdmissionClasses.FindAsync(admissionClass.Id);

        Assert.NotNull(persistedClass);
        Assert.Equal(TruncateToMicroseconds(admissionClass.CreatedAt), persistedClass.CreatedAt);
    }

    private static AdmissionClass CreateAdmissionClass(
        int totalSeats = 10,
        int heldSeats = 0,
        int confirmedSeats = 0)
    {
        return new AdmissionClass
        {
            Id = Guid.NewGuid(),
            Name = $"Test Class {Guid.NewGuid():N}",
            TotalSeats = totalSeats,
            HeldSeats = heldSeats,
            ConfirmedSeats = confirmedSeats,
            CreatedAt = DateTimeOffset.UtcNow
        };
    }

    private static AdmissionHold CreateAdmissionHold(
        Guid classId,
        string studentId,
        HoldStatus status = HoldStatus.Held)
    {
        var createdAt = DateTimeOffset.UtcNow;

        return new AdmissionHold
        {
            Id = Guid.NewGuid(),
            ClassId = classId,
            StudentId = studentId,
            Status = status,
            CreatedAt = createdAt,
            ExpiresAt = createdAt.AddMinutes(10)
        };
    }

    private static DateTimeOffset TruncateToMicroseconds(DateTimeOffset value)
    {
        var utcTicks = value.UtcTicks - value.UtcTicks % TimeSpan.TicksPerMicrosecond;
        return new DateTimeOffset(utcTicks, TimeSpan.Zero);
    }
}
