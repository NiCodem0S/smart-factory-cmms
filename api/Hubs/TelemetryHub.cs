using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.Simulation;

namespace SmartFactoryCMMS.Api.Hubs;

[Authorize]
public class TelemetryHub(ApplicationDbContext db) : Hub
{
    public static string HallGroup(Guid hallId) => $"hall:{hallId:D}";
    // A moved machine never publishes new readings to subscribers of its former hall.
    public static string MachineGroup(Guid hallId, Guid machineId) => $"hall:{hallId:D}:machine:{machineId:D}";

    public async Task JoinHall(Guid hallId)
    {
        var actor = SimulationActor.From(Context.User);
        if (!actor.CanRead(hallId) || !await db.FactoryHalls.AnyAsync(h => h.Id == hallId, Context.ConnectionAborted))
        {
            throw new HubException("Hall access denied.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, HallGroup(hallId));
    }

    public Task LeaveHall(Guid hallId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, HallGroup(hallId));

    public async Task JoinMachine(Guid machineId)
    {
        var machine = await db.Machines.AsNoTracking().SingleOrDefaultAsync(m => m.Id == machineId && m.IsActive, Context.ConnectionAborted);
        if (machine is null || !SimulationActor.From(Context.User).CanRead(machine.FactoryHallId))
        {
            throw new HubException("Machine access denied.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, MachineGroup(machine.FactoryHallId, machineId));
    }
}
