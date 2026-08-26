using System.Security.Claims;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Services.Abstract;

namespace SmartFactoryCMMS.Api.Services
{
    public class UserContext : IUserContext
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public UserContext(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        private ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;

        public bool IsAuthenticated => User?.Identity?.IsAuthenticated ?? false;

        public Guid? UserId
        {
            get
            {
                var idClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                return Guid.TryParse(idClaim, out var id) ? id : null;
            }
        }

        public string? Email => User?.FindFirst(ClaimTypes.Email)?.Value;

        public UserRole? Role
        {
            get
            {
                var roleClaim = User?.FindFirst(ClaimTypes.Role)?.Value;
                return Enum.TryParse<UserRole>(roleClaim, out var role) ? role : null;
            }
        }

        public Guid? FactoryHallId
        {
            get
            {
                var hallClaim = User?.FindFirst("hallId")?.Value;
                return Guid.TryParse(hallClaim, out var hallId) ? hallId : null;
            }
        }

        public bool IsSuperAdmin => Role == UserRole.SuperAdmin;
        public bool IsHallAdmin => Role == UserRole.HallAdmin;
        public bool IsTechnician => Role == UserRole.Technician;

        public bool HasAccessToHall(Guid hallId)
        {
            if (IsSuperAdmin) return true;
            return FactoryHallId == hallId;
        }
    }
}
