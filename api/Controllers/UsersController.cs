using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Repositories.Abstract;

namespace SmartFactoryCMMS.Api.Controllers
{
    [Authorize(Roles = nameof(UserRole.SuperAdmin))]
    [Route("api/[controller]")]
    [ApiController]
    public class UsersController : ControllerBase
    {
        private readonly IUserRepository _userRepository;

        public UsersController(IUserRepository userRepository)
        {
            _userRepository = userRepository;
        }

        [HttpGet]
        public async Task<ActionResult<List<UserDto>>> GetUsers(
            [FromQuery] UserRole? role = null,
            [FromQuery] Guid? hallId = null,
            CancellationToken ct = default)
        {
            var users = await _userRepository.GetUsersAsync(role, hallId, ct);
            return Ok(users);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<UserDto>> GetUserById(Guid id, CancellationToken ct = default)
        {
            var user = await _userRepository.GetUserProfileAsync(id, ct);

            if (user == null)
            {
                return NotFound(new { message = $"User with ID {id} not found." });
            }

            return Ok(user);
        }
    }
}
