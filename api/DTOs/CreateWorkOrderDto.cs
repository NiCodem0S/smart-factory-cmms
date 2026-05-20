using System;

namespace SmartFactoryCMMS.Api.DTOs
{
	public class CreateWorkOrderDto
	{
		public string Title { get; set; } = string.Empty;
		public string? Description { get; set; }
		public string Type { get; set; } = "Routine";
		public Guid MachineId { get; set; }
		public DateTime? DueDate { get; set; }
		public Guid? AssignedUserId { get; set; }
	}
}