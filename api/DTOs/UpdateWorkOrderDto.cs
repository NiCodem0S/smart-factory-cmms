using System;

namespace SmartFactoryCMMS.Api.DTOs
{
	public class UpdateWorkOrderDto
    {
		public string Title { get; set; } = string.Empty;
		public string? Description { get; set; }
		public string Status { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
		public DateTime? DueDate { get; set; }
		public Guid? AssignedUserId { get; set; }
    }
}