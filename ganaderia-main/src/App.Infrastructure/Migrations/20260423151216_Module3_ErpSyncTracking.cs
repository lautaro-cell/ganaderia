using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NodaTime;

#nullable disable

namespace App.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Module3_ErpSyncTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EventTemplates_Tenants_TenantId",
                table: "EventTemplates");

            migrationBuilder.DropIndex(
                name: "IX_EventTemplates_TenantId",
                table: "EventTemplates");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "LastSyncAt",
                table: "GestorMaxConfigs",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastSyncError",
                table: "GestorMaxConfigs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "LastSyncOk",
                table: "GestorMaxConfigs",
                type: "boolean",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "EventTemplates",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "DebitAccountCode",
                table: "EventTemplates",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "CreditAccountCode",
                table: "EventTemplates",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Code",
                table: "EventTemplates",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.CreateTable(
                name: "AccountConfigurations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    EventType = table.Column<int>(type: "integer", nullable: false),
                    DebitAccountCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CreditAccountCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<Instant>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<Instant>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccountConfigurations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AccountConfigurations_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ActivityAnimalCategories",
                columns: table => new
                {
                    ActivityId = table.Column<Guid>(type: "uuid", nullable: false),
                    AnimalCategoryId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActivityAnimalCategories", x => new { x.ActivityId, x.AnimalCategoryId });
                    table.ForeignKey(
                        name: "FK_ActivityAnimalCategories_Activities_ActivityId",
                        column: x => x.ActivityId,
                        principalTable: "Activities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ActivityAnimalCategories_AnimalCategories_AnimalCategoryId",
                        column: x => x.AnimalCategoryId,
                        principalTable: "AnimalCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ActivityEventTypes",
                columns: table => new
                {
                    ActivityId = table.Column<Guid>(type: "uuid", nullable: false),
                    EventType = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActivityEventTypes", x => new { x.ActivityId, x.EventType });
                    table.ForeignKey(
                        name: "FK_ActivityEventTypes_Activities_ActivityId",
                        column: x => x.ActivityId,
                        principalTable: "Activities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EventTemplate_Tenant_Code",
                table: "EventTemplates",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EventTemplate_Tenant_EventType",
                table: "EventTemplates",
                columns: new[] { "TenantId", "EventType" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AccountConfig_Tenant_EventType",
                table: "AccountConfigurations",
                columns: new[] { "TenantId", "EventType" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ActivityAnimalCategories_CategoryId",
                table: "ActivityAnimalCategories",
                column: "AnimalCategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_ActivityEventTypes_EventType",
                table: "ActivityEventTypes",
                column: "EventType");

            migrationBuilder.AddForeignKey(
                name: "FK_EventTemplates_Tenants_TenantId",
                table: "EventTemplates",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EventTemplates_Tenants_TenantId",
                table: "EventTemplates");

            migrationBuilder.DropTable(
                name: "AccountConfigurations");

            migrationBuilder.DropTable(
                name: "ActivityAnimalCategories");

            migrationBuilder.DropTable(
                name: "ActivityEventTypes");

            migrationBuilder.DropIndex(
                name: "IX_EventTemplate_Tenant_Code",
                table: "EventTemplates");

            migrationBuilder.DropIndex(
                name: "IX_EventTemplate_Tenant_EventType",
                table: "EventTemplates");

            migrationBuilder.DropColumn(
                name: "LastSyncAt",
                table: "GestorMaxConfigs");

            migrationBuilder.DropColumn(
                name: "LastSyncError",
                table: "GestorMaxConfigs");

            migrationBuilder.DropColumn(
                name: "LastSyncOk",
                table: "GestorMaxConfigs");

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "EventTemplates",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200);

            migrationBuilder.AlterColumn<string>(
                name: "DebitAccountCode",
                table: "EventTemplates",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.AlterColumn<string>(
                name: "CreditAccountCode",
                table: "EventTemplates",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.AlterColumn<string>(
                name: "Code",
                table: "EventTemplates",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.CreateIndex(
                name: "IX_EventTemplates_TenantId",
                table: "EventTemplates",
                column: "TenantId");

            migrationBuilder.AddForeignKey(
                name: "FK_EventTemplates_Tenants_TenantId",
                table: "EventTemplates",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
