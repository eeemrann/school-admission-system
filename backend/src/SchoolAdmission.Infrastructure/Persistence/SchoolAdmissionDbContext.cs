using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using SchoolAdmission.Domain.Entities;
using SchoolAdmission.Domain.Enums;

namespace SchoolAdmission.Infrastructure.Persistence;

public sealed class SchoolAdmissionDbContext(DbContextOptions<SchoolAdmissionDbContext> options) : DbContext(options)
{
    public DbSet<AdmissionClass> AdmissionClasses => Set<AdmissionClass>();

    public DbSet<AdmissionHold> AdmissionHolds => Set<AdmissionHold>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        var utcDateTimeOffsetConverter = new ValueConverter<DateTimeOffset, DateTimeOffset>(
            value => ToUtc(value),
            value => ToUtc(value));
        var nullableUtcDateTimeOffsetConverter = new ValueConverter<DateTimeOffset?, DateTimeOffset?>(
            value => ToUtc(value),
            value => ToUtc(value));
        var holdStatusConverter = new ValueConverter<HoldStatus, string>(
            value => ToPersistedStatus(value),
            value => FromPersistedStatus(value));

        var admissionClass = modelBuilder.Entity<AdmissionClass>();
        admissionClass.ToTable("admission_classes", tableBuilder =>
        {
            tableBuilder.HasCheckConstraint(
                "ck_admission_classes_total_seats_positive",
                "\"total_seats\" > 0");
            tableBuilder.HasCheckConstraint(
                "ck_admission_classes_held_seats_non_negative",
                "\"held_seats\" >= 0");
            tableBuilder.HasCheckConstraint(
                "ck_admission_classes_confirmed_seats_non_negative",
                "\"confirmed_seats\" >= 0");
            tableBuilder.HasCheckConstraint(
                "ck_admission_classes_seat_capacity",
                "\"held_seats\" + \"confirmed_seats\" <= \"total_seats\"");
            tableBuilder.HasCheckConstraint(
                "ck_admission_classes_name_not_empty",
                "btrim(\"name\") <> ''");
        });
        admissionClass.HasKey(entity => entity.Id).HasName("pk_admission_classes");
        admissionClass.Property(entity => entity.Id)
            .HasColumnName("id")
            .HasColumnType("uuid")
            .ValueGeneratedNever();
        admissionClass.Property(entity => entity.Name)
            .HasColumnName("name")
            .HasColumnType("text")
            .IsRequired();
        admissionClass.Property(entity => entity.TotalSeats)
            .HasColumnName("total_seats")
            .HasColumnType("integer")
            .IsRequired();
        admissionClass.Property(entity => entity.HeldSeats)
            .HasColumnName("held_seats")
            .HasColumnType("integer")
            .IsRequired();
        admissionClass.Property(entity => entity.ConfirmedSeats)
            .HasColumnName("confirmed_seats")
            .HasColumnType("integer")
            .IsRequired();
        admissionClass.Property(entity => entity.CreatedAt)
            .HasColumnName("created_at")
            .HasColumnType("timestamp with time zone")
            .HasPrecision(6)
            .HasConversion(utcDateTimeOffsetConverter)
            .IsRequired();

        var admissionHold = modelBuilder.Entity<AdmissionHold>();
        admissionHold.ToTable("admission_holds", tableBuilder =>
        {
            tableBuilder.HasCheckConstraint(
                "ck_admission_holds_student_id_not_empty",
                "btrim(\"student_id\") <> ''");
            tableBuilder.HasCheckConstraint(
                "ck_admission_holds_expires_after_created",
                "\"expires_at\" > \"created_at\"");
            tableBuilder.HasCheckConstraint(
                "ck_admission_holds_status_valid",
                "\"status\" IN ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')");
        });
        admissionHold.HasKey(entity => entity.Id).HasName("pk_admission_holds");
        admissionHold.Property(entity => entity.Id)
            .HasColumnName("id")
            .HasColumnType("uuid")
            .ValueGeneratedNever();
        admissionHold.Property(entity => entity.ClassId)
            .HasColumnName("class_id")
            .HasColumnType("uuid")
            .IsRequired();
        admissionHold.Property(entity => entity.StudentId)
            .HasColumnName("student_id")
            .HasColumnType("text")
            .IsRequired();
        admissionHold.Property(entity => entity.Status)
            .HasColumnName("status")
            .HasColumnType("text")
            .HasConversion(holdStatusConverter)
            .IsRequired();
        admissionHold.Property(entity => entity.CreatedAt)
            .HasColumnName("created_at")
            .HasColumnType("timestamp with time zone")
            .HasPrecision(6)
            .HasConversion(utcDateTimeOffsetConverter)
            .IsRequired();
        admissionHold.Property(entity => entity.ExpiresAt)
            .HasColumnName("expires_at")
            .HasColumnType("timestamp with time zone")
            .HasPrecision(6)
            .HasConversion(utcDateTimeOffsetConverter)
            .IsRequired();
        admissionHold.Property(entity => entity.ConfirmedAt)
            .HasColumnName("confirmed_at")
            .HasColumnType("timestamp with time zone")
            .HasPrecision(6)
            .HasConversion(nullableUtcDateTimeOffsetConverter);
        admissionHold.Property(entity => entity.CancelledAt)
            .HasColumnName("cancelled_at")
            .HasColumnType("timestamp with time zone")
            .HasPrecision(6)
            .HasConversion(nullableUtcDateTimeOffsetConverter);

        admissionHold.HasOne<AdmissionClass>()
            .WithMany()
            .HasForeignKey(entity => entity.ClassId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("fk_admission_holds_admission_classes_class_id");

        admissionHold.HasIndex(entity => entity.ClassId)
            .HasDatabaseName("ix_admission_holds_class_id");
        admissionHold.HasIndex(entity => new { entity.ClassId, entity.StudentId })
            .IsUnique()
            .HasDatabaseName("ux_admission_holds_active_class_student")
            .HasFilter("\"status\" IN ('HELD', 'CONFIRMED')");
        admissionHold.HasIndex(entity => entity.ExpiresAt)
            .HasDatabaseName("ix_admission_holds_held_expires_at")
            .HasFilter("\"status\" = 'HELD'");
        admissionHold.HasIndex(entity => new { entity.StudentId, entity.CreatedAt })
            .HasDatabaseName("ix_admission_holds_student_created_at");
    }

    private static DateTimeOffset ToUtc(DateTimeOffset value) => value.ToUniversalTime();

    private static DateTimeOffset? ToUtc(DateTimeOffset? value) => value?.ToUniversalTime();

    private static string ToPersistedStatus(HoldStatus status) => status switch
    {
        HoldStatus.Held => "HELD",
        HoldStatus.Confirmed => "CONFIRMED",
        HoldStatus.Expired => "EXPIRED",
        HoldStatus.Cancelled => "CANCELLED",
        _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Unknown hold status.")
    };

    private static HoldStatus FromPersistedStatus(string status) => status switch
    {
        "HELD" => HoldStatus.Held,
        "CONFIRMED" => HoldStatus.Confirmed,
        "EXPIRED" => HoldStatus.Expired,
        "CANCELLED" => HoldStatus.Cancelled,
        _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Unknown persisted hold status.")
    };
}
