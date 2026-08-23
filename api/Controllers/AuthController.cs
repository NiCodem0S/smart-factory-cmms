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
        private readonly IMapper _mapper;

        public AuthController(
            IUserRepository userRepository,
            IJwtTokenService jwtTokenService,
            IPasswordHasher<User> passwordHasher,
            IMapper mapper)
        {
            _userRepository = userRepository;
            _jwtTokenService = jwtTokenService;
            _passwordHasher = passwordHasher;
            _mapper = mapper;
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
            var userDto = _mapper.Map<UserDto>(user);

            return Ok(new LoginResponseDto
            {
                Token = token,
                User = userDto
            });
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
