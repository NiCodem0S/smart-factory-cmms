using System;

namespace SmartFactoryCMMS.Api.DTOs
{
    public class WorkOrderDetailDto
    {
        public Guid Id { get; set; }
        public string TicketNumber { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public Guid MachineId { get; set; }
        public string MachineName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? DueDate { get; set; }
        public DateTime? ResolvedAt { get; set; }
        public Guid? AssignedUserId { get; set; }
        public string? AssignedToUserName { get; set; }
    }
}
