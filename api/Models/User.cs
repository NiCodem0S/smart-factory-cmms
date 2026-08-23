using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Helpers.Enums;
using System.ComponentModel.DataAnnotations.Schema;

namespace SmartFactoryCMMS.Api.Models
{
    [Index(nameof(Email), IsUnique = true)]
    public class User
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public UserRole Role { get; set; } = UserRole.Technician;
        public bool IsActive { get; set; } = true;
        public Guid? FactoryHallId { get; set; }
        public FactoryHall? FactoryHall { get; set; }

        public ICollection<WorkOrder> AssignedWorkOrders { get; set; } = new List<WorkOrder>();
    }
}
