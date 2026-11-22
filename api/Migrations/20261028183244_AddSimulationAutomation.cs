using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFactoryCMMS.Api.Migrations
{
    
    public partial class AddSimulationAutomation : Migration
    {
        
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "SimulationAutomationEnabled",
                table: "SystemSettings",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "AutomaticRepairAtUtc",
                table: "Machines",
                type: "datetimeoffset",
                nullable: true);
        }

        
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SimulationAutomationEnabled",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "AutomaticRepairAtUtc",
                table: "Machines");
        }
    }
}
