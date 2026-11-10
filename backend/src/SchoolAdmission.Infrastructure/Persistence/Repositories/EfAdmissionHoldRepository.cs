using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;
using SchoolAdmission.Application.Reservations;
using SchoolAdmission.Domain.Entities;
using SchoolAdmission.Domain.Enums;

namespace SchoolAdmission.Infrastructure.Persistence.Repositories;

public sealed class EfAdmissionHoldRepository(SchoolAdmissionDbContext dbContext) : IAdmissionHoldRepository
{
    private const string ActiveApplicationConstraintName = "ux_admission_holds_active_class_student";

    public async Task<HoldReservationResult> CreateHeldAsync(
        Guid classId,
        string studentId,
        DateTimeOffset createdAt,
        TimeSpan duration,
        CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(
            IsolationLevel.ReadCommitted,
            cancellationToken);

        var admissionClass = await LockClassAsync(classId, cancellationToken);
        if (admissionClass is null)
        {
            await transaction.RollbackAsync(CancellationToken.None);
            return new HoldReservationResult(null, HoldReservationFailure.ClassNotFound);
        }

        var dueHolds = await LockDueHoldsAsync(classId, createdAt, cancellationToken);
        ExpireHolds(admissionClass, dueHolds);

        var hasActiveApplication = await dbContext.AdmissionHolds.AnyAsync(
            hold => hold.ClassId == classId
                && hold.StudentId == studentId
                && (hold.Status == HoldStatus.Held || hold.Status == HoldStatus.Confirmed),
            cancellationToken);
        if (hasActiveApplication)
        {
            await transaction.RollbackAsync(CancellationToken.None);
            return new HoldReservationResult(null, HoldReservationFailure.DuplicateActiveApplication);
        }

        var availableSeats = admissionClass.TotalSeats
            - admissionClass.HeldSeats
            - admissionClass.ConfirmedSeats;
        if (availableSeats <= 0)
        {
            await transaction.RollbackAsync(CancellationToken.None);
            return new HoldReservationResult(null, HoldReservationFailure.NoSeatsAvailable);
        }

        var hold = new AdmissionHold
        {
            Id = Guid.NewGuid(),
            ClassId = classId,
            StudentId = studentId,
            Status = HoldStatus.Held,
            CreatedAt = createdAt,
            ExpiresAt = createdAt.Add(duration)
        };
        dbContext.AdmissionHolds.Add(hold);
        admissionClass.HeldSeats++;

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return new HoldReservationResult(hold, null);
        }
        catch (DbUpdateException exception) when (IsActiveApplicationUniqueViolation(exception))
        {
            await transaction.RollbackAsync(CancellationToken.None);
            return new HoldReservationResult(null, HoldReservationFailure.DuplicateActiveApplication);
        }
    }

    public async Task<AdmissionHold?> GetByIdWithExpiryReconciliationAsync(
        Guid holdId,
        DateTimeOffset currentUtcTime,
        CancellationToken cancellationToken)
    {
        var classId = await FindClassIdAsync(holdId, cancellationToken);
        if (classId is null)
        {
            return null;
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(
            IsolationLevel.ReadCommitted,
            cancellationToken);

        var admissionClass = await LockClassAsync(classId.Value, cancellationToken);
        if (admissionClass is null || !await LockHoldAsync(holdId, cancellationToken))
        {
            await transaction.RollbackAsync(CancellationToken.None);
            return null;
        }

        var hold = await dbContext.AdmissionHolds
            .SingleOrDefaultAsync(candidate => candidate.Id == holdId, cancellationToken);
        if (hold is null)
        {
            await transaction.RollbackAsync(CancellationToken.None);
            return null;
        }

        if (hold.Status == HoldStatus.Held && hold.ExpiresAt <= currentUtcTime)
        {
            ExpireHold(admissionClass, hold);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return hold;
    }

    private async Task<AdmissionClass?> LockClassAsync(
        Guid classId,
        CancellationToken cancellationToken)
    {
        await using var command = CreateCommand(
            """
            SELECT 1
            FROM admission_classes
            WHERE id = @class_id
            FOR UPDATE
            """,
            ("class_id", classId));

        var classExists = false;
        await using (var reader = await command.ExecuteReaderAsync(cancellationToken))
        {
            classExists = await reader.ReadAsync(cancellationToken);
        }

        if (!classExists)
        {
            return null;
        }

        return await dbContext.AdmissionClasses
            .SingleAsync(admissionClass => admissionClass.Id == classId, cancellationToken);
    }

    private async Task<List<AdmissionHold>> LockDueHoldsAsync(
        Guid classId,
        DateTimeOffset currentUtcTime,
        CancellationToken cancellationToken)
    {
        await using var command = CreateCommand(
            """
            SELECT id
            FROM admission_holds
            WHERE class_id = @class_id
              AND status = 'HELD'
              AND expires_at <= @current_utc_time
            FOR UPDATE
            """,
            ("class_id", classId),
            ("current_utc_time", currentUtcTime));

        var holdIds = new List<Guid>();
        await using (var reader = await command.ExecuteReaderAsync(cancellationToken))
        {
            while (await reader.ReadAsync(cancellationToken))
            {
                holdIds.Add(reader.GetGuid(0));
            }
        }

        if (holdIds.Count == 0)
        {
            return [];
        }

        return await dbContext.AdmissionHolds
            .Where(hold => holdIds.Contains(hold.Id))
            .ToListAsync(cancellationToken);
    }

    private async Task<Guid?> FindClassIdAsync(Guid holdId, CancellationToken cancellationToken)
    {
        return await dbContext.AdmissionHolds
            .AsNoTracking()
            .Where(hold => hold.Id == holdId)
            .Select(hold => (Guid?)hold.ClassId)
            .SingleOrDefaultAsync(cancellationToken);
    }

    private async Task<bool> LockHoldAsync(Guid holdId, CancellationToken cancellationToken)
    {
        await using var command = CreateCommand(
            """
            SELECT 1
            FROM admission_holds
            WHERE id = @hold_id
            FOR UPDATE
            """,
            ("hold_id", holdId));

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken);
    }

    private DbCommand CreateCommand(
        string commandText,
        params (string Name, object Value)[] parameters)
    {
        var connection = dbContext.Database.GetDbConnection();
        var transaction = dbContext.Database.CurrentTransaction?.GetDbTransaction()
            ?? throw new InvalidOperationException("A database transaction is required for row locking.");
        var command = connection.CreateCommand();
        command.CommandText = commandText;
        command.Transaction = transaction;

        foreach (var (name, value) in parameters)
        {
            var parameter = command.CreateParameter();
            parameter.ParameterName = name;
            parameter.Value = value;
            command.Parameters.Add(parameter);
        }

        return command;
    }

    private static void ExpireHolds(AdmissionClass admissionClass, IReadOnlyList<AdmissionHold> dueHolds)
    {
        foreach (var hold in dueHolds)
        {
            ExpireHold(admissionClass, hold);
        }
    }

    private static void ExpireHold(AdmissionClass admissionClass, AdmissionHold hold)
    {
        if (hold.Status != HoldStatus.Held)
        {
            return;
        }

        if (admissionClass.HeldSeats <= 0)
        {
            throw new InvalidOperationException("The class held-seat counter is inconsistent with its holds.");
        }

        hold.Status = HoldStatus.Expired;
        admissionClass.HeldSeats--;
    }

    internal static bool IsActiveApplicationUniqueViolation(DbUpdateException exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is PostgresException postgresException
                && postgresException.SqlState == PostgresErrorCodes.UniqueViolation
                && string.Equals(
                    postgresException.ConstraintName,
                    ActiveApplicationConstraintName,
                    StringComparison.Ordinal))
            {
                return true;
            }
        }

        return false;
    }
}
