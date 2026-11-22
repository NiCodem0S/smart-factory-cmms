using Microsoft.EntityFrameworkCore;

namespace SmartFactoryCMMS.Api.Data;

public static class SimulationProfileSeeder
{
    /// Only fills missing profiles. Never changes an existing profile or launch request.
    public static int Seed(ApplicationDbContext context)
    {
        var machines = context.Machines
            .Where(m => m.IsActive && m.SimulationProfile == null)
            .ToList();

        foreach (var machine in machines)
        {
            machine.SimulationProfile = context.CreateDefaultSimulationProfile(machine);
        }

        if (machines.Count > 0)
        {
            context.SaveChanges();
        }

        return machines.Count;
    }
}
