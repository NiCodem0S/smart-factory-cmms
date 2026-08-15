using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using SmartFactoryCMMS.Api.Helpers.Enums;

namespace SmartFactoryCMMS.Api.DTOs
{
    public class MachineListDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string SerialNumber { get; set; } = string.Empty;
        public MachineStatus Status { get; set; } = MachineStatus.Offline;  // Running, Warning, Maintenance, Error, Offline
        public int ActiveWorkOrdersCount { get; set; }
    }
}