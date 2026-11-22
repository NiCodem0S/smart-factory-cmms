using System.Security.Claims;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Services.Abstract;

namespace SmartFactoryCMMS.Api.Simulation;

public sealed record SimulationActor(UserRole? Role, Guid? HallId, bool Authenticated)
{
    public bool CanRead(Guid hallId) => Authenticated &&
        (Role == UserRole.SuperAdmin || (Role is UserRole.HallAdmin or UserRole.Technician && HallId == hallId));

    public void RequireAdmin()
    {
        if (!Authenticated || Role is not (UserRole.SuperAdmin or UserRole.HallAdmin))
            throw new SimulationRequestException(403, "Only an administrator can control simulations.");
    }

    public void RequireHall(Guid hallId)
    {
        if (!CanRead(hallId)) throw new SimulationRequestException(404, "Machine or production line not found.");
    }

    public static SimulationActor From(IUserContext user) => new(user.Role, user.FactoryHallId, user.IsAuthenticated);

    public static SimulationActor From(ClaimsPrincipal? user)
    {
        var role = Enum.TryParse<UserRole>(user?.FindFirstValue(ClaimTypes.Role), out var parsed) ? (UserRole?)parsed : null;
        var hall = Guid.TryParse(user?.FindFirstValue("hallId"), out var id) ? (Guid?)id : null;
        return new(role, hall, user?.Identity?.IsAuthenticated == true);
    }
}

public sealed class SimulationRequestException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}
