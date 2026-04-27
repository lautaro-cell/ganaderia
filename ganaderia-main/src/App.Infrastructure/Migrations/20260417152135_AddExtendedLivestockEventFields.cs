using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace App.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddExtendedLivestockEventFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "DestinationActivityId",
                table: "LivestockEvents",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DestinationCategoryId",
                table: "LivestockEvents",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DestinationFieldId",
                table: "LivestockEvents",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OriginActivityId",
                table: "LivestockEvents",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OriginCategoryId",
                table: "LivestockEvents",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DestinationActivityId",
                table: "LivestockEvents");

            migrationBuilder.DropColumn(
                name: "DestinationCategoryId",
                table: "LivestockEvents");

            migrationBuilder.DropColumn(
                name: "DestinationFieldId",
                table: "LivestockEvents");

            migrationBuilder.DropColumn(
                name: "OriginActivityId",
                table: "LivestockEvents");

            migrationBuilder.DropColumn(
                name: "OriginCategoryId",
                table: "LivestockEvents");
        }
    }
}
