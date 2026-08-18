using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFactoryCMMS.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLastStatusChanedAtcolumntoProductionLinesEntity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LastStatusChangedAt",
                table: "ProductionLines",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastStatusChangedAt",
                table: "ProductionLines");
        }
    }
}
