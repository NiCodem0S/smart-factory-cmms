using System;

namespace SmartFactoryCMMS.Api.DTOs
{
	public class CreateWorkOrderDto
	{
		public string Title { get; set; } = string.Empty;
		public string Description { get; set; } = string.Empty;
		public string Priority { get; set; } = "Medium";
		public Guid MachineId { get; set; }
	}
}