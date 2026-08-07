using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFactoryCMMS.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFactoryHallHierarchy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "FactoryHallId",
                table: "ProductionLines",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "FactoryHallId",
                table: "Machines",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "FactoryHalls",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FactoryHalls", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProductionLines_FactoryHallId",
                table: "ProductionLines",
                column: "FactoryHallId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionLines_Name",
                table: "ProductionLines",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Machines_FactoryHallId",
                table: "Machines",
                column: "FactoryHallId");

            migrationBuilder.AddForeignKey(
                name: "FK_Machines_FactoryHalls_FactoryHallId",
                table: "Machines",
                column: "FactoryHallId",
                principalTable: "FactoryHalls",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionLines_FactoryHalls_FactoryHallId",
                table: "ProductionLines",
                column: "FactoryHallId",
                principalTable: "FactoryHalls",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Machines_FactoryHalls_FactoryHallId",
                table: "Machines");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductionLines_FactoryHalls_FactoryHallId",
                table: "ProductionLines");

            migrationBuilder.DropTable(
                name: "FactoryHalls");

            migrationBuilder.DropIndex(
                name: "IX_ProductionLines_FactoryHallId",
                table: "ProductionLines");

            migrationBuilder.DropIndex(
                name: "IX_ProductionLines_Name",
                table: "ProductionLines");

            migrationBuilder.DropIndex(
                name: "IX_Machines_FactoryHallId",
                table: "Machines");

            migrationBuilder.DropColumn(
                name: "FactoryHallId",
                table: "ProductionLines");

            migrationBuilder.DropColumn(
                name: "FactoryHallId",
                table: "Machines");
        }
    }
}
