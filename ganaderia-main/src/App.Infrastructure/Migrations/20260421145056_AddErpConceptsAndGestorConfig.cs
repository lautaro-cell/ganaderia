using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NodaTime;

#nullable disable

namespace App.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddErpConceptsAndGestorConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ErpTenantId",
                table: "Tenants");

            migrationBuilder.AddColumn<string>(
                name: "GestorMaxApiKeyEncrypted",
                table: "Tenants",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GestorMaxDatabaseId",
                table: "Tenants",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ErpConcepts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Stock = table.Column<double>(type: "double precision", nullable: false),
                    UnitA = table.Column<string>(type: "text", nullable: true),
                    UnitB = table.Column<string>(type: "text", nullable: true),
                    GrupoConcepto = table.Column<string>(type: "text", nullable: true),
                    SubGrupoConcepto = table.Column<string>(type: "text", nullable: true),
                    ExternalErpId = table.Column<string>(type: "text", nullable: true),
                    LastSyncDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<Instant>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<Instant>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ErpConcepts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ErpConcepts_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ErpConcepts_TenantId",
                table: "ErpConcepts",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ErpConcepts");

            migrationBuilder.DropColumn(
                name: "GestorMaxApiKeyEncrypted",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "GestorMaxDatabaseId",
                table: "Tenants");

            migrationBuilder.AddColumn<string>(
                name: "ErpTenantId",
                table: "Tenants",
                type: "text",
                nullable: false,
                defaultValue: "");
        }
    }
}
