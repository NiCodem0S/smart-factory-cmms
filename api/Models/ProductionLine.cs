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
        private string _status = "Offline"  // e.g. "Running", "vzHalted", "Maintenance", "Warning"
        public string Status 
        { 
            get => _status; 
            set
            {
                _status = value;
                LastStatusChangedAt = DateTime.UtcNow;
            }
        } 
        
        public int? OrderInHall { get; set; }
        public DateTime? LastStatusChangedAt { get; set; } = DateTime.UtcNow;

        public Guid? CurrentProductId { get; set; }
        public Product? CurrentProduct { get; set; }

        public Guid FactoryHallId { get; set; }
        public FactoryHall FactoryHall { get; set; } = null!;

        public ICollection<Machine> Machines { get; set; } = new List<Machine>();
    }
}