using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFactoryCMMS.Api.Migrations
{
    
    public partial class AddOperatingHoursToMachineDetails : Migration
    {
        
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LastStatusChangedAt",
                table: "Machines",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "TotalOperatingHours",
                table: "Machines",
                type: "float",
                nullable: false,
                defaultValue: 0.0);
        }

        
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastStatusChangedAt",
                table: "Machines");

            migrationBuilder.DropColumn(
                name: "TotalOperatingHours",
                table: "Machines");
        }
    }
}
