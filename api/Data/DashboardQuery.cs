using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Models;

namespace SmartFactoryCMMS.Api.Data;

public static class DashboardQuery
{
    public static IQueryable<DashboardMachineDto> ProjectMachines(IQueryable<Machine> accessibleMachines,
        IQueryable<TelemetryRead> readings, DateTime toUtc)
    {
        // Look up the latest reading by machine so the database can serve it from the history index.
        var machines = from machine in accessibleMachines
                       let latestReadingId = machine.TelemetryReads.Where(t => t.Timestamp <= toUtc &&
                               (t.Temperature.HasValue || t.Vibration.HasValue || t.PowerLoadKw.HasValue || t.NetworkLatencyMs.HasValue))
                           .OrderByDescending(t => t.Timestamp).ThenByDescending(t => t.Id)
                           .Select(t => (Guid?)t.Id).FirstOrDefault()
                       join sample in readings on latestReadingId equals (Guid?)sample.Id into latestReadings
                       from latest in latestReadings.DefaultIfEmpty()
                       orderby machine.FactoryHall.Name, machine.Name, machine.Id
                       select new DashboardMachineDto(machine.Id, machine.Name, machine.Category, machine.SerialNumber,
                           machine.FactoryHallId, machine.FactoryHall.Name,
                           machine.ProductionLine != null && machine.ProductionLine.FactoryHallId == machine.FactoryHallId ? machine.ProductionLineId : null,
                           machine.ProductionLine != null && machine.ProductionLine.FactoryHallId == machine.FactoryHallId ? machine.ProductionLine.Name : null,
                           machine.OrderInLine, machine.Status, machine.TotalProduced,
                           latest == null ? null : new DashboardTelemetryDto(latest.Timestamp, latest.Temperature, latest.Vibration,
                               latest.PowerLoadKw, latest.NetworkLatencyMs),
                           machine.TotalOperatingHours, machine.CycleTimeSeconds, machine.Icon);
        return machines;
    }
}
