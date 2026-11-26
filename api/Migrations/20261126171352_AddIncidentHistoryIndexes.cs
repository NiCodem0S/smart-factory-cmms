using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFactoryCMMS.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddIncidentHistoryIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Incidents_MachineId",
                table: "Incidents");

            migrationBuilder.CreateIndex(
                name: "IX_Incidents_MachineId_TriggeredAt",
                table: "Incidents",
                columns: new[] { "MachineId", "TriggeredAt" })
                .Annotation("SqlServer:Include", new[] { "Status", "Severity" });

            migrationBuilder.CreateIndex(
                name: "IX_Incidents_TriggeredAt_Id",
                table: "Incidents",
                columns: new[] { "TriggeredAt", "Id" })
                .Annotation("SqlServer:Include", new[] { "MachineId", "Status", "Severity" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Incidents_MachineId_TriggeredAt",
                table: "Incidents");

            migrationBuilder.DropIndex(
                name: "IX_Incidents_TriggeredAt_Id",
                table: "Incidents");

            migrationBuilder.CreateIndex(
                name: "IX_Incidents_MachineId",
                table: "Incidents",
                column: "MachineId");
        }
    }
}
