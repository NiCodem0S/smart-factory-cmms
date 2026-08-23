using System.ComponentModel.DataAnnotations;
using SmartFactoryCMMS.Api.Helpers.Enums;

namespace SmartFactoryCMMS.Api.DTOs
{
    public class RegisterDto
    {
        [Required]
        [MaxLength(100)]
        public string FullName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [MaxLength(100)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(6, ErrorMessage = "Password must be at least 6 characters long.")]
        public string Password { get; set; } = string.Empty;

        public UserRole Role { get; set; } = UserRole.Technician;

        public Guid? FactoryHallId { get; set; }
    }
}
