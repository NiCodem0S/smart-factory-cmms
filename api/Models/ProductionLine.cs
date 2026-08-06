using System.ComponentModel.DataAnnotations;

namespace SmartFactoryCMMS.Api.Models
{
    public class ProductionLine
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Running"; // e.g. "Running", "Halted", "Maintenance"

        public Guid? CurrentProductId { get; set; }
        public Product? CurrentProduct { get; set; }

        public ICollection<Machine> Machines { get; set; } = new List<Machine>();
    }
}
