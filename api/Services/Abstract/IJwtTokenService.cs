using SmartFactoryCMMS.Api.Models;
namespace SmartFactoryCMMS.Api.Services.Abstract
{
    public interface IJwtTokenService
    {
        string GenerateToken(User user);
    }
}
