using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations.Schema;

namespace SmartFactoryCMMS.Models
{
    [Index(nameof(TicketNumber), IsUnique = true)] //UNIQUE in SQL
    public class WorkOrder
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string TicketNumber { get; set; } = string.Empty;
        public Guid MachineId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Type { get; set; } = string.Empty; // Routine, Predictive, Critical
        public string Status { get; set; } = "Open"; // Open, InProgress, Review, Resolved
        public Guid? AssignedUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? DueDate { get; set; }
        public DateTime? ResolvedAt { get; set; }

        public Machine? Machine { get; set; }
        public User? AssignedUser { get; set; }
    }
}
