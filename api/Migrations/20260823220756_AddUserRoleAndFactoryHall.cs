using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFactoryCMMS.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUserRoleAndFactoryHall : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "FactoryHallId",
                table: "Users",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "ProductionLines",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50);

            migrationBuilder.CreateIndex(
                name: "IX_Users_FactoryHallId",
                table: "Users",
                column: "FactoryHallId");

            migrationBuilder.AddForeignKey(
                name: "FK_Users_FactoryHalls_FactoryHallId",
                table: "Users",
                column: "FactoryHallId",
                principalTable: "FactoryHalls",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Users_FactoryHalls_FactoryHallId",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_FactoryHallId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "FactoryHallId",
                table: "Users");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "ProductionLines",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");
        }
    }
}
