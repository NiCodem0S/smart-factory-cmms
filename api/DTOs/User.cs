using SmartFactoryCMMS.Api.Helpers.Enums;
namespace SmartFactoryCMMS.Api.DTOs
{
    public class UserDto
    {
        public Guid Id { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public UserRole Role { get; set; }
        public Guid? FactoryHallId { get; set; }
        public string? FactoryHallName { get; set; }
        public bool IsActive { get; set; }
    }
}