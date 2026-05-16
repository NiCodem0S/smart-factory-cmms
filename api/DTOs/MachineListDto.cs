using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SmartFactoryCMMS.Api.DTOs
{
    public class MachineListDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string SerialNumber { get; set; } = string.Empty;
        public string Status { get; set; } = "Offline";  // Running, Maintenance, Error, Offline
        public DateTime InstallationDate { get; set; }
        public int ActiveWorkOrdersCount { get; set; }
        public DateTime? LastTelemetryRead { get; set; }
    }
}