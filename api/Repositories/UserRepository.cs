using AutoMapper;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Repositories.Abstract;

namespace SmartFactoryCMMS.Api.Repositories
{
    public class UserRepository : IUserRepository
    {
        private readonly ApplicationDbContext _context;
        private readonly IMapper _mapper;

        public UserRepository(ApplicationDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        public async Task<User?> GetUserByEmailAsync(string email, CancellationToken ct = default)
        {
            return await _context.Users
                .Include(u => u.FactoryHall)
                .FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower(), ct);
        }

        public async Task<UserDto?> GetUserProfileAsync(Guid id, CancellationToken ct = default)
        {
            var user = await _context.Users
                .Include(u => u.FactoryHall)
                .FirstOrDefaultAsync(u => u.Id == id, ct);

            if (user == null)
            {
                return null;
            }

            return _mapper.Map<UserDto>(user);
        }

        public async Task<List<UserDto>> GetUsersAsync(UserRole? role = null, Guid? hallId = null, CancellationToken ct = default)
        {
            IQueryable<User> query = _context.Users
                .Include(u => u.FactoryHall)
                .Where(u => u.IsActive);

            if (role.HasValue)
            {
                query = query.Where(u => u.Role == role.Value);
            }

            if (hallId.HasValue)
            {
                query = query.Where(u => u.FactoryHallId == hallId.Value);
            }

            var users = await query
                .OrderBy(u => u.FullName)
                .ToListAsync(ct);

            return _mapper.Map<List<UserDto>>(users);
        }

        public async Task<bool> EmailExistsAsync(string email, CancellationToken ct = default)
        {
            return await _context.Users.AnyAsync(u => u.Email.ToLower() == email.ToLower(), ct);
        }

        public async Task<User> CreateUserAsync(User user, CancellationToken ct = default)
        {
            await _context.Users.AddAsync(user, ct);
            await _context.SaveChangesAsync(ct);
            return user;
        }
    }
}
