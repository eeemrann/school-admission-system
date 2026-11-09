using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SchoolAdmission.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "admission_classes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    total_seats = table.Column<int>(type: "integer", nullable: false),
                    held_seats = table.Column<int>(type: "integer", nullable: false),
                    confirmed_seats = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp(6) with time zone", precision: 6, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_admission_classes", x => x.id);
                    table.CheckConstraint("ck_admission_classes_confirmed_seats_non_negative", "\"confirmed_seats\" >= 0");
                    table.CheckConstraint("ck_admission_classes_held_seats_non_negative", "\"held_seats\" >= 0");
                    table.CheckConstraint("ck_admission_classes_name_not_empty", "btrim(\"name\") <> ''");
                    table.CheckConstraint("ck_admission_classes_seat_capacity", "\"held_seats\" + \"confirmed_seats\" <= \"total_seats\"");
                    table.CheckConstraint("ck_admission_classes_total_seats_positive", "\"total_seats\" > 0");
                });

            migrationBuilder.CreateTable(
                name: "admission_holds",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    class_id = table.Column<Guid>(type: "uuid", nullable: false),
                    student_id = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp(6) with time zone", precision: 6, nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp(6) with time zone", precision: 6, nullable: false),
                    confirmed_at = table.Column<DateTimeOffset>(type: "timestamp(6) with time zone", precision: 6, nullable: true),
                    cancelled_at = table.Column<DateTimeOffset>(type: "timestamp(6) with time zone", precision: 6, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_admission_holds", x => x.id);
                    table.CheckConstraint("ck_admission_holds_expires_after_created", "\"expires_at\" > \"created_at\"");
                    table.CheckConstraint("ck_admission_holds_status_valid", "\"status\" IN ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')");
                    table.CheckConstraint("ck_admission_holds_student_id_not_empty", "btrim(\"student_id\") <> ''");
                    table.ForeignKey(
                        name: "fk_admission_holds_admission_classes_class_id",
                        column: x => x.class_id,
                        principalTable: "admission_classes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_admission_holds_class_id",
                table: "admission_holds",
                column: "class_id");

            migrationBuilder.CreateIndex(
                name: "ix_admission_holds_held_expires_at",
                table: "admission_holds",
                column: "expires_at",
                filter: "\"status\" = 'HELD'");

            migrationBuilder.CreateIndex(
                name: "ix_admission_holds_student_created_at",
                table: "admission_holds",
                columns: new[] { "student_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ux_admission_holds_active_class_student",
                table: "admission_holds",
                columns: new[] { "class_id", "student_id" },
                unique: true,
                filter: "\"status\" IN ('HELD', 'CONFIRMED')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "admission_holds");

            migrationBuilder.DropTable(
                name: "admission_classes");
        }
    }
}
