using System.ComponentModel.DataAnnotations;

namespace SmartFactoryCMMS.Api.DTOs
{
    public class CreateMachineDto
    {
        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string Category { get; set; } = string.Empty;

        [StringLength(100)]
        public string SerialNumber { get; set; } = string.Empty;

        [Required]
        [StringLength(30)]
        public string Status { get; set; } = "Offline";  // Running, Maintenance, Error, Offline
    }
}