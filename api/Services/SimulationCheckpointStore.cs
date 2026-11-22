using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Simulation;

namespace SmartFactoryCMMS.Api.Services;

public interface ISimulationCheckpointStore
{
    Task<MachineSimState?> ReadAsync(Guid machineId, CancellationToken ct = default);
    Task SaveAsync(Machine machine, MachineSimState state, IReadOnlyList<SimulationStatusChanged> transitions, CancellationToken ct = default);
}

/// Uses the calling operation's scoped context; all staged changes commit with one SaveChanges transaction.
public sealed class SimulationCheckpointStore(ApplicationDbContext db, SimulationDiagnostics diagnostics) : ISimulationCheckpointStore
{
    public async Task<MachineSimState?> ReadAsync(Guid machineId, CancellationToken ct = default)
    {
        var checkpoint = await db.SimulationCheckpoints.AsNoTracking().SingleOrDefaultAsync(row => row.MachineId == machineId, ct);
        if (checkpoint is null)
        {
            return null;
        }

        if (checkpoint.SchemaVersion != MachineSimState.CurrentSchemaVersion)
        {
            throw new InvalidOperationException("Unsupported SQL checkpoint schema.");
        }

        return new MachineSimState
        {
            SchemaVersion = checkpoint.SchemaVersion,
            MachineId = checkpoint.MachineId,
            TickNumber = checkpoint.TickNumber,
            ProfileVersion = checkpoint.ProfileVersion,
            LastTickAtUtc = checkpoint.LastTickAtUtc,
            MachineStatus = checkpoint.MachineStatus,
            TotalProduced = checkpoint.TotalProduced,
            Temperature = checkpoint.Temperature,
            Vibration = checkpoint.Vibration,
            PowerLoadKw = checkpoint.PowerLoadKw,
            CycleProgressSeconds = checkpoint.CycleProgressSeconds,
            Wear = checkpoint.Wear,
            IsOverheating = checkpoint.IsOverheating,
            IsOvervibrating = checkpoint.IsOvervibrating,
            FaultMode = checkpoint.FaultMode
        };
    }

    public async Task SaveAsync(Machine machine, MachineSimState state, IReadOnlyList<SimulationStatusChanged> transitions, CancellationToken ct = default)
    {
        var checkpoint = await db.SimulationCheckpoints.SingleOrDefaultAsync(row => row.MachineId == machine.Id, ct);
        if (checkpoint is null)
        {
            checkpoint = new SimulationCheckpoint { MachineId = machine.Id };
            db.SimulationCheckpoints.Add(checkpoint);
        }
        if (checkpoint.TickNumber > state.TickNumber)
        {
            throw new InvalidOperationException("A stale tick cannot overwrite a newer checkpoint.");
        }

        checkpoint.SchemaVersion = state.SchemaVersion;
        checkpoint.TickNumber = state.TickNumber;
        checkpoint.ProfileVersion = state.ProfileVersion;
        checkpoint.LastTickAtUtc = state.LastTickAtUtc;
        checkpoint.SavedAtUtc = DateTimeOffset.UtcNow;
        checkpoint.Temperature = state.Temperature;
        checkpoint.Vibration = state.Vibration;
        checkpoint.PowerLoadKw = state.PowerLoadKw;
        checkpoint.CycleProgressSeconds = state.CycleProgressSeconds;
        checkpoint.Wear = state.Wear;
        checkpoint.IsOverheating = state.IsOverheating;
        checkpoint.IsOvervibrating = state.IsOvervibrating;
        checkpoint.FaultMode = state.FaultMode;
        checkpoint.TotalProduced = state.TotalProduced;
        checkpoint.MachineStatus = state.MachineStatus;
        machine.TotalProduced = state.TotalProduced;
        machine.Status = state.MachineStatus;

        foreach (var change in transitions)
        {
            if (change.NewStatus is MachineStatus.Warning or MachineStatus.Error)
            {
                // Stable identity also covers a committed transaction whose acknowledgement was lost.
                var identity = FormattableString.Invariant($"{machine.Id:D}/{change.OccurredAtUtc.UtcTicks}/{change.NewStatus}");
                var eventId = new Guid(SHA256.HashData(Encoding.UTF8.GetBytes(identity)).AsSpan(0, 16));
                if (db.Incidents.Local.Any(i => i.Id == eventId) || await db.Incidents.AnyAsync(i => i.Id == eventId, ct))
                {
                    continue;
                }

                db.Incidents.Add(new Incident
                {
                    Id = eventId,
                    MachineId = machine.Id,
                    TriggeredAt = change.OccurredAtUtc.UtcDateTime,
                    Severity = change.NewStatus == MachineStatus.Error ? "Critical" : "Warning",
                    Status = "Active",
                    Message = FormattableString.Invariant($"Simulation: {machine.Name}: {change.NewStatus} ({change.FaultMode}); T={change.Temperature:F2}°C, V={change.Vibration:F2} mm/s, P={change.PowerLoadKw:F2} kW")
                });
                // Critical history never goes through the lossy sample channel.
                db.TelemetryRead.Add(new TelemetryRead
                {
                    Id = eventId,
                    MachineId = machine.Id,
                    Timestamp = change.OccurredAtUtc.UtcDateTime,
                    Temperature = (decimal)change.Temperature,
                    Vibration = (decimal)change.Vibration,
                    PowerLoadKw = (decimal)change.PowerLoadKw
                });
            }
            else if (change.NewStatus == MachineStatus.Running)
            {
                var incidents = await db.Incidents.Where(i => i.MachineId == machine.Id && i.Status == "Active" &&
                    i.Severity == "Warning" && i.Message.StartsWith("Simulation:")).ToListAsync(ct);
                foreach (var incident in incidents.Concat(db.Incidents.Local.Where(i => i.MachineId == machine.Id && i.Status == "Active" && i.Severity == "Warning" && i.Message.StartsWith("Simulation:"))).Distinct())
                {
                    incident.Status = "Resolved";
                }
            }
        }
        await db.SaveChangesAsync(ct);
        diagnostics.RecordCheckpoint((checkpoint.SavedAtUtc - checkpoint.LastTickAtUtc).TotalSeconds);
    }
}
