using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFactoryCMMS.Api.Migrations
{
    
    public partial class AddTelemetryRetentionIndexes : Migration
    {
        
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TelemetryRead_MachineId",
                table: "TelemetryRead");

            migrationBuilder.CreateIndex(
                name: "IX_TelemetryRead_MachineId_Timestamp",
                table: "TelemetryRead",
                columns: new[] { "MachineId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_TelemetryRead_Timestamp",
                table: "TelemetryRead",
                column: "Timestamp");
        }

        
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TelemetryRead_MachineId_Timestamp",
                table: "TelemetryRead");

            migrationBuilder.DropIndex(
                name: "IX_TelemetryRead_Timestamp",
                table: "TelemetryRead");

            migrationBuilder.CreateIndex(
                name: "IX_TelemetryRead_MachineId",
                table: "TelemetryRead",
                column: "MachineId");
        }
    }
}
