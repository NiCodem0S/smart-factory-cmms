using System.Security.Claims;
using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Repositories.Abstract;
using SmartFactoryCMMS.Api.Services.Abstract;

namespace SmartFactoryCMMS.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IUserRepository _userRepository;
        private readonly IJwtTokenService _jwtTokenService;
        private readonly IPasswordHasher<User> _passwordHasher;
        private readonly IRefreshTokenService _refreshTokenService;
        private readonly IConfiguration _config;
        private readonly IMapper _mapper;

        private const string RefreshTokenCookieName = "cmms_refresh_token";

        public AuthController(
            IUserRepository userRepository,
            IJwtTokenService jwtTokenService,
            IPasswordHasher<User> passwordHasher,
            IRefreshTokenService refreshTokenService,
            IConfiguration config,
            IMapper mapper)
        {
            _userRepository = userRepository;
            _jwtTokenService = jwtTokenService;
            _passwordHasher = passwordHasher;
            _refreshTokenService = refreshTokenService;
            _config = config;
            _mapper = mapper;
        }

        private void SetRefreshTokenCookie(string refreshToken)
        {
            if (!int.TryParse(_config["Jwt:RefreshTokenExpiryInDays"], out var expiryDays) || expiryDays <= 0)
            {
                throw new InvalidOperationException("Configuration error: 'Jwt:RefreshTokenExpiryInDays' is missing or invalid in appsettings.json.");
            }

            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Lax,
                Path = "/api/auth",
                Expires = DateTimeOffset.UtcNow.AddDays(expiryDays)
            };

            Response.Cookies.Append(RefreshTokenCookieName, refreshToken, cookieOptions);
        }

        private void DeleteRefreshTokenCookie()
        {
            Response.Cookies.Delete(RefreshTokenCookieName, new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Lax,
                Path = "/api/auth"
            });
        }

        [HttpPost("login")]
        public async Task<ActionResult<LoginResponseDto>> Login([FromBody] LoginDto loginDto, CancellationToken ct = default)
        {
            var user = await _userRepository.GetUserByEmailAsync(loginDto.Email, ct);

            if (user == null || !user.IsActive)
            {
                return Unauthorized(new { message = "Invalid email or password." });
            }

            var verificationResult = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, loginDto.Password);

            if (verificationResult == PasswordVerificationResult.Failed)
            {
                return Unauthorized(new { message = "Invalid email or password." });
            }

            var token = _jwtTokenService.GenerateToken(user);

            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = Request.Headers.UserAgent.ToString();

            var rawRefreshToken = _refreshTokenService.GenerateRawToken();
            await _refreshTokenService.CreateRefreshTokenAsync(user.Id, rawRefreshToken, ipAddress, userAgent, ct);

            SetRefreshTokenCookie(rawRefreshToken);

            var userDto = _mapper.Map<UserDto>(user);

            return Ok(new LoginResponseDto
            {
                Token = token,
                User = userDto
            });
        }

        [HttpPost("refresh")]
        public async Task<ActionResult<LoginResponseDto>> Refresh(CancellationToken ct)
        {
            if (!Request.Cookies.TryGetValue(RefreshTokenCookieName, out var rawRefreshToken) || string.IsNullOrEmpty(rawRefreshToken))
            {
                return Unauthorized(new { message = "Refresh token is missing. " });
            }

            var ipAdress = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = Request.Headers.UserAgent.ToString();

            var (success, newRawToken, user, errorMessage) = await _refreshTokenService.RotateRefreshTokenAsync(
                rawRefreshToken, ipAdress, userAgent, ct);

            if(!success || user == null || newRawToken == null)
            {
                DeleteRefreshTokenCookie();
                return Unauthorized(new { message = errorMessage ?? "Failed to refresh token." });
            }

            SetRefreshTokenCookie(newRawToken);

            var newAccessToken = _jwtTokenService.GenerateToken(user);
            var userDto = _mapper.Map<UserDto>(user);
            return Ok(new LoginResponseDto
            {
                Token = newAccessToken,
                User = userDto
            });

        }

        [HttpPost("logout")]
        public async Task<IActionResult> Logout(CancellationToken ct = default)
        {
            if (Request.Cookies.TryGetValue(RefreshTokenCookieName, out var rawRefreshToken) && !string.IsNullOrEmpty(rawRefreshToken))
            {
                await _refreshTokenService.RevokeRefreshTokenAsync(rawRefreshToken, ct);
            }
            DeleteRefreshTokenCookie();
            return Ok(new { message = "Logged out successfully." });
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<ActionResult<UserDto>> GetCurrentUser(CancellationToken ct = default)
        {
            var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
            {
                return Unauthorized(new { message = "User not authenticated." });
            }

            var userProfile = await _userRepository.GetUserProfileAsync(userId, ct);

            if (userProfile == null)
            {
                return NotFound(new { message = "User not found." });
            }

            return Ok(userProfile);
        }
    }
}
