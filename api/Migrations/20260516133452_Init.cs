using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFactoryCMMS.Api.Migrations
{
    /// <inheritdoc />
    public partial class Init : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Machines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Category = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SerialNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    InstallationDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    StaticProperties = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Machines", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SystemSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SiteName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Timezone = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PeakPowerLimitMw = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    SlackWebhookUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RawTelemetryRetentionDays = table.Column<int>(type: "int", nullable: false),
                    EnableEmailAlerts = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SystemSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Role = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WorkShifts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    StartTime = table.Column<TimeSpan>(type: "time", nullable: false),
                    EndTime = table.Column<TimeSpan>(type: "time", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkShifts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AlertThresholds",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MachineId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MetricType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    WarningValue = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CriticalValue = table.Column<decimal>(type: "decimal(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AlertThresholds", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AlertThresholds_Machines_MachineId",
                        column: x => x.MachineId,
                        principalTable: "Machines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Incidents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MachineId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TriggeredAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Message = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Severity = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Incidents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Incidents_Machines_MachineId",
                        column: x => x.MachineId,
                        principalTable: "Machines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MachinePredictions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MachineId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CalculatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    HealthScore = table.Column<int>(type: "int", nullable: false),
                    RemainingUsefulLifeHours = table.Column<int>(type: "int", nullable: true),
                    PredictedFailureComponent = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MachinePredictions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MachinePredictions_Machines_MachineId",
                        column: x => x.MachineId,
                        principalTable: "Machines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TelemetryRead",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MachineId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Temperature = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Vibration = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    NetworkLatencyMs = table.Column<int>(type: "int", nullable: true),
                    PowerLoadKw = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    AdditionalMetrics = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TelemetryRead", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TelemetryRead_Machines_MachineId",
                        column: x => x.MachineId,
                        principalTable: "Machines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorkOrders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TicketNumber = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    MachineId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Type = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    AssignedUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DueDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ResolvedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkOrders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkOrders_Machines_MachineId",
                        column: x => x.MachineId,
                        principalTable: "Machines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_WorkOrders_Users_AssignedUserId",
                        column: x => x.AssignedUserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ProductionLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MachineId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ShiftId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "datetime2", nullable: false),
                    GoodParts = table.Column<int>(type: "int", nullable: false),
                    DefectiveParts = table.Column<int>(type: "int", nullable: false),
                    AverageCycleTimeSeconds = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    IdealCycleTimeSeconds = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    ActiveOperatingSeconds = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductionLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductionLogs_Machines_MachineId",
                        column: x => x.MachineId,
                        principalTable: "Machines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductionLogs_WorkShifts_ShiftId",
                        column: x => x.ShiftId,
                        principalTable: "WorkShifts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AlertThresholds_MachineId",
                table: "AlertThresholds",
                column: "MachineId");

            migrationBuilder.CreateIndex(
                name: "IX_Incidents_MachineId",
                table: "Incidents",
                column: "MachineId");

            migrationBuilder.CreateIndex(
                name: "IX_MachinePredictions_MachineId",
                table: "MachinePredictions",
                column: "MachineId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionLogs_MachineId",
                table: "ProductionLogs",
                column: "MachineId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionLogs_ShiftId",
                table: "ProductionLogs",
                column: "ShiftId");

            migrationBuilder.CreateIndex(
                name: "IX_TelemetryRead_MachineId",
                table: "TelemetryRead",
                column: "MachineId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrders_AssignedUserId",
                table: "WorkOrders",
                column: "AssignedUserId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrders_MachineId",
                table: "WorkOrders",
                column: "MachineId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrders_TicketNumber",
                table: "WorkOrders",
                column: "TicketNumber",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AlertThresholds");

            migrationBuilder.DropTable(
                name: "Incidents");

            migrationBuilder.DropTable(
                name: "MachinePredictions");

            migrationBuilder.DropTable(
                name: "ProductionLogs");

            migrationBuilder.DropTable(
                name: "SystemSettings");

            migrationBuilder.DropTable(
                name: "TelemetryRead");

            migrationBuilder.DropTable(
                name: "WorkOrders");

            migrationBuilder.DropTable(
                name: "WorkShifts");

            migrationBuilder.DropTable(
                name: "Machines");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
