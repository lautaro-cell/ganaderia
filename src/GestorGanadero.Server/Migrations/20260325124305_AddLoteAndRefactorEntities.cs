using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestorGanadero.Migrations
{
    /// <inheritdoc />
    public partial class AddLoteAndRefactorEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "LoteId",
                table: "LivestockEvents",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Observations",
                table: "LivestockEvents",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsGlobal",
                table: "Activities",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "Lotes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    FieldId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Lotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Lotes_Fields_FieldId",
                        column: x => x.FieldId,
                        principalTable: "Fields",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ActivityLote",
                columns: table => new
                {
                    ActivitiesId = table.Column<Guid>(type: "uuid", nullable: false),
                    LoteId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActivityLote", x => new { x.ActivitiesId, x.LoteId });
                    table.ForeignKey(
                        name: "FK_ActivityLote_Activities_ActivitiesId",
                        column: x => x.ActivitiesId,
                        principalTable: "Activities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ActivityLote_Lotes_LoteId",
                        column: x => x.LoteId,
                        principalTable: "Lotes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LivestockEvents_LoteId",
                table: "LivestockEvents",
                column: "LoteId");

            migrationBuilder.CreateIndex(
                name: "IX_ActivityLote_LoteId",
                table: "ActivityLote",
                column: "LoteId");

            migrationBuilder.CreateIndex(
                name: "IX_Lotes_FieldId",
                table: "Lotes",
                column: "FieldId");

            migrationBuilder.AddForeignKey(
                name: "FK_LivestockEvents_Lotes_LoteId",
                table: "LivestockEvents",
                column: "LoteId",
                principalTable: "Lotes",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_LivestockEvents_Lotes_LoteId",
                table: "LivestockEvents");

            migrationBuilder.DropTable(
                name: "ActivityLote");

            migrationBuilder.DropTable(
                name: "Lotes");

            migrationBuilder.DropIndex(
                name: "IX_LivestockEvents_LoteId",
                table: "LivestockEvents");

            migrationBuilder.DropColumn(
                name: "LoteId",
                table: "LivestockEvents");

            migrationBuilder.DropColumn(
                name: "Observations",
                table: "LivestockEvents");

            migrationBuilder.DropColumn(
                name: "IsGlobal",
                table: "Activities");
        }
    }
}
