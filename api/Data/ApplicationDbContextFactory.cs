using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Options;
using SmartFactoryCMMS.Api.Configuration;

namespace SmartFactoryCMMS.Api.Data;

/// Allows EF commands to build the model without running the application seeder.
public class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var directory = Directory.GetCurrentDirectory();
        if (!File.Exists(Path.Combine(directory, "appsettings.json")) &&
            File.Exists(Path.Combine(directory, "api", "appsettings.json")))
        {
            directory = Path.Combine(directory, "api");
        }

        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";
        var configurationBuilder = new ConfigurationBuilder()
            .SetBasePath(directory)
            .AddJsonFile("appsettings.json")
            .AddJsonFile($"appsettings.{environment}.json", optional: true);
        if (environment == "Development")
        {
            configurationBuilder.AddUserSecrets<ApplicationDbContext>(optional: true);
        }
        var configuration = configurationBuilder.AddEnvironmentVariables().Build();

        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");
        var simulation = configuration.GetSection(SimulationOptions.SectionName).Get<SimulationOptions>() ?? new();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connectionString).Options;
        return new ApplicationDbContext(options, Options.Create(simulation));
    }
}
