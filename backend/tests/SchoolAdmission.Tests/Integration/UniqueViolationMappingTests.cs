using Microsoft.EntityFrameworkCore;
using Npgsql;
using SchoolAdmission.Domain.Entities;
using SchoolAdmission.Domain.Enums;
using SchoolAdmission.Infrastructure.Persistence;
using SchoolAdmission.Infrastructure.Persistence.Repositories;

namespace SchoolAdmission.Tests.Integration;

[Collection(PostgresDatabaseCollectionDefinition.Name)]
public sealed class UniqueViolationMappingTests(PostgresFixture fixture)
{
    [Fact]
    public async Task RecognizesActiveApplicationUniqueIndexViolation()
    {
        var admissionClass = CreateClass();
        var firstHold = CreateHold(admissionClass.Id, "unique-active-student");

        await using var dbContext = fixture.CreateDbContext();
        dbContext.AdmissionClasses.Add(admissionClass);
        dbContext.AdmissionHolds.Add(firstHold);
        await dbContext.SaveChangesAsync();

        dbContext.AdmissionHolds.Add(CreateHold(admissionClass.Id, firstHold.StudentId));
        var exception = await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
        var postgresException = Assert.IsType<PostgresException>(exception.InnerException);

        Assert.Equal("ux_admission_holds_active_class_student", postgresException.ConstraintName);
        Assert.True(EfAdmissionHoldRepository.IsActiveApplicationUniqueViolation(exception));
    }

    [Fact]
    public async Task RequiresTheExactActiveApplicationConstraintName()
    {
        const string indexName = "ux_test_unrelated_student_constraint";
        const string studentId = "student-unrelated-index";

        await using var setupContext = fixture.CreateDbContext();
        await setupContext.Database.ExecuteSqlRawAsync(
            $"CREATE UNIQUE INDEX \"{indexName}\" ON admission_holds (student_id) WHERE student_id = '{studentId}'");

        try
        {
            var firstClass = CreateClass();
            var secondClass = CreateClass();

            setupContext.AdmissionClasses.AddRange(firstClass, secondClass);
            setupContext.AdmissionHolds.Add(CreateHold(firstClass.Id, studentId));
            await setupContext.SaveChangesAsync();

            setupContext.AdmissionHolds.Add(CreateHold(secondClass.Id, studentId));
            var exception = await Assert.ThrowsAsync<DbUpdateException>(() => setupContext.SaveChangesAsync());
            var postgresException = Assert.IsType<PostgresException>(exception.InnerException);

            Assert.Equal(PostgresErrorCodes.UniqueViolation, postgresException.SqlState);
            Assert.Equal(indexName, postgresException.ConstraintName);
            Assert.False(EfAdmissionHoldRepository.IsActiveApplicationUniqueViolation(exception));
        }
        finally
        {
            await using var cleanupContext = fixture.CreateDbContext();
            await cleanupContext.Database.ExecuteSqlRawAsync($"DROP INDEX IF EXISTS \"{indexName}\"");
        }
    }

    [Fact]
    public async Task DoesNotClassifyPrimaryKeyViolationAsActiveApplicationDuplicate()
    {
        var admissionClass = CreateClass();

        await using (var writeContext = fixture.CreateDbContext())
        {
            writeContext.AdmissionClasses.Add(admissionClass);
            await writeContext.SaveChangesAsync();
        }

        await using var duplicateContext = fixture.CreateDbContext();
        duplicateContext.AdmissionClasses.Add(CreateClass(admissionClass.Id));
        var exception = await Assert.ThrowsAsync<DbUpdateException>(() => duplicateContext.SaveChangesAsync());
        var postgresException = Assert.IsType<PostgresException>(exception.InnerException);

        Assert.Equal(PostgresErrorCodes.UniqueViolation, postgresException.SqlState);
        Assert.Equal("pk_admission_classes", postgresException.ConstraintName);
        Assert.False(EfAdmissionHoldRepository.IsActiveApplicationUniqueViolation(exception));
    }

    private static AdmissionClass CreateClass(Guid? id = null) => new()
    {
        Id = id ?? Guid.NewGuid(),
        Name = $"Unique Mapping Class {Guid.NewGuid():N}",
        TotalSeats = 5,
        HeldSeats = 0,
        ConfirmedSeats = 0,
        CreatedAt = DateTimeOffset.UtcNow
    };

    private static AdmissionHold CreateHold(Guid classId, string studentId) => new()
    {
        Id = Guid.NewGuid(),
        ClassId = classId,
        StudentId = studentId,
        Status = HoldStatus.Held,
        CreatedAt = DateTimeOffset.UtcNow,
        ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(10)
    };
}
