using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace App.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SyncModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_AccountingDrafts_ActivityId",
                table: "AccountingDrafts",
                column: "ActivityId");

            migrationBuilder.CreateIndex(
                name: "IX_AccountingDrafts_CategoryId",
                table: "AccountingDrafts",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_AccountingDrafts_FieldId",
                table: "AccountingDrafts",
                column: "FieldId");

            migrationBuilder.AddForeignKey(
                name: "FK_AccountingDrafts_Activities_ActivityId",
                table: "AccountingDrafts",
                column: "ActivityId",
                principalTable: "Activities",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_AccountingDrafts_AnimalCategories_CategoryId",
                table: "AccountingDrafts",
                column: "CategoryId",
                principalTable: "AnimalCategories",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_AccountingDrafts_Fields_FieldId",
                table: "AccountingDrafts",
                column: "FieldId",
                principalTable: "Fields",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AccountingDrafts_Activities_ActivityId",
                table: "AccountingDrafts");

            migrationBuilder.DropForeignKey(
                name: "FK_AccountingDrafts_AnimalCategories_CategoryId",
                table: "AccountingDrafts");

            migrationBuilder.DropForeignKey(
                name: "FK_AccountingDrafts_Fields_FieldId",
                table: "AccountingDrafts");

            migrationBuilder.DropIndex(
                name: "IX_AccountingDrafts_ActivityId",
                table: "AccountingDrafts");

            migrationBuilder.DropIndex(
                name: "IX_AccountingDrafts_CategoryId",
                table: "AccountingDrafts");

            migrationBuilder.DropIndex(
                name: "IX_AccountingDrafts_FieldId",
                table: "AccountingDrafts");
        }
    }
}
