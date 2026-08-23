using System.ComponentModel.DataAnnotations;

namespace SmartFactoryCMMS.Api.Models
{
    public class FactoryHall
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        public ICollection<ProductionLine> ProductionLines { get; set; } = new List<ProductionLine>();
        public ICollection<Machine> Machines { get; set; } = new List<Machine>();
        public ICollection<User> AssignedUsers { get; set; } = new List<User>();
    }
}
