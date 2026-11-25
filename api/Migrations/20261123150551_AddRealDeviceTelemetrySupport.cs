using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFactoryCMMS.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRealDeviceTelemetrySupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DeviceKeyHash",
                table: "Machines",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeviceKeyPrefix",
                table: "Machines",
                type: "nvarchar(24)",
                maxLength: 24,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ExpectedIntervalSeconds",
                table: "Machines",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "ExternalDeviceId",
                table: "Machines",
                type: "nvarchar(127)",
                maxLength: 127,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OfflineTimeoutSeconds",
                table: "Machines",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "SupportedMetrics",
                table: "Machines",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TelemetrySource",
                table: "Machines",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Simulated");

            migrationBuilder.CreateIndex(
                name: "IX_Machines_DeviceKeyHash",
                table: "Machines",
                column: "DeviceKeyHash",
                unique: true,
                filter: "[DeviceKeyHash] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Machines_DeviceKeyHash",
                table: "Machines");

            migrationBuilder.DropColumn(
                name: "DeviceKeyHash",
                table: "Machines");

            migrationBuilder.DropColumn(
                name: "DeviceKeyPrefix",
                table: "Machines");

            migrationBuilder.DropColumn(
                name: "ExpectedIntervalSeconds",
                table: "Machines");

            migrationBuilder.DropColumn(
                name: "ExternalDeviceId",
                table: "Machines");

            migrationBuilder.DropColumn(
                name: "OfflineTimeoutSeconds",
                table: "Machines");

            migrationBuilder.DropColumn(
                name: "SupportedMetrics",
                table: "Machines");

            migrationBuilder.DropColumn(
                name: "TelemetrySource",
                table: "Machines");
        }
    }
}
