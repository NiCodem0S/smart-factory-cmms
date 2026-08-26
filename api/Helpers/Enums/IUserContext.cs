using SmartFactoryCMMS.Api.Helpers.Enums;
namespace SmartFactoryCMMS.Api.Services.Abstract
{
    public interface IUserContext
    {
        Guid? UserId { get; }
        string? Email { get; }
        UserRole? Role { get; }
        Guid? FactoryHallId { get; }
        bool IsAuthenticated { get; }
        bool IsSuperAdmin { get; }
        bool IsHallAdmin { get; }
        bool IsTechnician { get; }

        bool HasAccessToHall(Guid hallId);
    }
}
