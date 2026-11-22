using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFactoryCMMS.Api.Migrations
{
    
    public partial class AddMachineSimulationModel : Migration
    {
        
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "SimulationEnabled",
                table: "Machines",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "SimulationCheckpoints",
                columns: table => new
                {
                    MachineId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SchemaVersion = table.Column<int>(type: "int", nullable: false),
                    TickNumber = table.Column<long>(type: "bigint", nullable: false),
                    ProfileVersion = table.Column<long>(type: "bigint", nullable: false),
                    Temperature = table.Column<double>(type: "float", nullable: false),
                    Vibration = table.Column<double>(type: "float", nullable: false),
                    PowerLoadKw = table.Column<double>(type: "float", nullable: false),
                    CycleProgressSeconds = table.Column<double>(type: "float", nullable: false),
                    Wear = table.Column<double>(type: "float", nullable: false),
                    IsOverheating = table.Column<bool>(type: "bit", nullable: false),
                    IsOvervibrating = table.Column<bool>(type: "bit", nullable: false),
                    FaultMode = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    TotalProduced = table.Column<int>(type: "int", nullable: false),
                    MachineStatus = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    LastTickAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    SavedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SimulationCheckpoints", x => x.MachineId);
                    table.CheckConstraint("CK_SimulationCheckpoints_FaultMode", "[FaultMode] IN ('None', 'Overheating', 'ExcessVibration', 'Generic')");
                    table.CheckConstraint("CK_SimulationCheckpoints_State", "[Temperature] BETWEEN -273.15 AND 1000000 AND [Vibration] >= 0 AND [PowerLoadKw] >= 0 AND [CycleProgressSeconds] >= 0 AND [Wear] BETWEEN 0 AND 1 AND [TotalProduced] >= 0");
                    table.CheckConstraint("CK_SimulationCheckpoints_Status", "[MachineStatus] IN ('Running', 'Warning', 'Error', 'Maintenance', 'Offline')");
                    table.CheckConstraint("CK_SimulationCheckpoints_Versions", "[SchemaVersion] >= 1 AND [ProfileVersion] >= 1 AND [TickNumber] >= 0");
                    table.ForeignKey(
                        name: "FK_SimulationCheckpoints_Machines_MachineId",
                        column: x => x.MachineId,
                        principalTable: "Machines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SimulationProfiles",
                columns: table => new
                {
                    MachineId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Preset = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    TickIntervalMs = table.Column<int>(type: "int", nullable: false),
                    AmbientTemperature = table.Column<double>(type: "float", nullable: false),
                    NormalTemperature = table.Column<double>(type: "float", nullable: false),
                    TemperatureNoiseAmplitude = table.Column<double>(type: "float", nullable: false),
                    TemperatureResponsePerSecond = table.Column<double>(type: "float", nullable: false),
                    OverheatingDegreesPerSecond = table.Column<double>(type: "float", nullable: false),
                    CoolingDegreesPerSecond = table.Column<double>(type: "float", nullable: false),
                    BaseVibration = table.Column<double>(type: "float", nullable: false),
                    VibrationNoiseAmplitude = table.Column<double>(type: "float", nullable: false),
                    ExcessVibrationAmplitude = table.Column<double>(type: "float", nullable: false),
                    NormalPowerKw = table.Column<double>(type: "float", nullable: false),
                    PowerNoiseAmplitudeKw = table.Column<double>(type: "float", nullable: false),
                    IdlePowerKw = table.Column<double>(type: "float", nullable: false),
                    OverheatingProbabilityPerHour = table.Column<double>(type: "float", nullable: false),
                    ExcessVibrationProbabilityPerHour = table.Column<double>(type: "float", nullable: false),
                    FailureProbabilityPerHour = table.Column<double>(type: "float", nullable: false),
                    WearPerHour = table.Column<double>(type: "float", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SimulationProfiles", x => x.MachineId);
                    table.CheckConstraint("CK_SimulationProfiles_Preset", "[Preset] IN ('Stable', 'WearAndTear', 'Chaos', 'Custom')");
                    table.CheckConstraint("CK_SimulationProfiles_Probabilities", "[OverheatingProbabilityPerHour] BETWEEN 0 AND 1 AND [ExcessVibrationProbabilityPerHour] BETWEEN 0 AND 1 AND [FailureProbabilityPerHour] BETWEEN 0 AND 1 AND [WearPerHour] BETWEEN 0 AND 1");
                    table.CheckConstraint("CK_SimulationProfiles_Thermal", "[AmbientTemperature] BETWEEN -273.15 AND 2000 AND [NormalTemperature] BETWEEN -273.15 AND 2000 AND [TemperatureNoiseAmplitude] BETWEEN 0 AND 2000 AND [TemperatureResponsePerSecond] BETWEEN 0 AND 100 AND [OverheatingDegreesPerSecond] BETWEEN 0.001 AND 2000 AND [CoolingDegreesPerSecond] BETWEEN 0.001 AND 2000");
                    table.CheckConstraint("CK_SimulationProfiles_Tick", "[TickIntervalMs] BETWEEN 100 AND 60000");
                    table.CheckConstraint("CK_SimulationProfiles_Version", "[Version] >= 1");
                    table.CheckConstraint("CK_SimulationProfiles_VibrationAndPower", "[BaseVibration] BETWEEN 0 AND 1000000 AND [VibrationNoiseAmplitude] BETWEEN 0 AND 1000000 AND [ExcessVibrationAmplitude] BETWEEN 0 AND 1000000 AND [NormalPowerKw] BETWEEN 0 AND 1000000 AND [PowerNoiseAmplitudeKw] BETWEEN 0 AND 1000000 AND [IdlePowerKw] BETWEEN 0 AND [NormalPowerKw]");
                    table.ForeignKey(
                        name: "FK_SimulationProfiles_Machines_MachineId",
                        column: x => x.MachineId,
                        principalTable: "Machines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
            // Backfill only missing profiles; preserve machine records and legacy baselines.
            migrationBuilder.Sql("""
                INSERT INTO [SimulationProfiles] (
                    [MachineId], [Preset], [Version], [CreatedAtUtc], [UpdatedAtUtc], [TickIntervalMs], [AmbientTemperature], [NormalTemperature], [TemperatureNoiseAmplitude], [TemperatureResponsePerSecond], [OverheatingDegreesPerSecond], [CoolingDegreesPerSecond], [BaseVibration], [VibrationNoiseAmplitude], [ExcessVibrationAmplitude], [NormalPowerKw], [PowerNoiseAmplitudeKw], [IdlePowerKw], [OverheatingProbabilityPerHour], [ExcessVibrationProbabilityPerHour], [FailureProbabilityPerHour], [WearPerHour]
                )
                SELECT m.[Id], N'Stable', 1, TODATETIMEOFFSET(SYSUTCDATETIME(), '+00:00'), TODATETIMEOFFSET(SYSUTCDATETIME(), '+00:00'), 1000, 25, baseline.[Temperature], 0.5, 0.1, 2, 0.5, baseline.[Vibration], 0.1, 3, baseline.[Power], 1.5, CASE WHEN baseline.[Power] < 0.1 THEN baseline.[Power] ELSE 0.1 END, 0.01, 0.01, 0.002, 0
                FROM [Machines] AS m
                OUTER APPLY (
                    SELECT
                        MAX(CASE WHEN [key] = 'NormTemp' AND [type] = 2 THEN TRY_CONVERT(float, [value]) END) AS [Temperature],
                        MAX(CASE WHEN [key] = 'BaseVib' AND [type] = 2 THEN TRY_CONVERT(float, [value]) END) AS [Vibration],
                        MAX(CASE WHEN [key] = 'NormPower' AND [type] = 2 THEN TRY_CONVERT(float, [value]) END) AS [Power]
                    FROM OPENJSON(CASE WHEN ISJSON(m.[StaticProperties]) = 1 THEN m.[StaticProperties] ELSE N'{}' END)
                ) AS legacy
                CROSS APPLY (VALUES (
                    CASE WHEN legacy.[Temperature] BETWEEN -273.15 AND 2000 THEN legacy.[Temperature] ELSE 60 END,
                    CASE WHEN legacy.[Vibration] BETWEEN 0 AND 1000000 THEN legacy.[Vibration] ELSE 1 END,
                    CASE WHEN legacy.[Power] BETWEEN 0 AND 1000000 THEN legacy.[Power] ELSE 15 END
                )) AS baseline([Temperature], [Vibration], [Power])
                WHERE m.[IsActive] = 1
                    AND NOT EXISTS (SELECT 1 FROM [SimulationProfiles] AS p WHERE p.[MachineId] = m.[Id]);
                """);
        }

        
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SimulationCheckpoints");

            migrationBuilder.DropTable(
                name: "SimulationProfiles");

            migrationBuilder.DropColumn(
                name: "SimulationEnabled",
                table: "Machines");
        }
    }
}
