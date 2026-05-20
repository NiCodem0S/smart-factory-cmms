using AutoMapper;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Models;

namespace SmartFactoryCMMS.Api.Mappers
{
    public class MachineMappingProfile : Profile
    {
        public MachineMappingProfile() 
        {
            // Existing
            CreateMap<UpdateMachineDto, Machine>();

            // Machine → MachineListDto (for table view)
            CreateMap<Machine, MachineListDto>()
                .ForMember(props => props.ActiveWorkOrdersCount, 
                    confg => confg.MapFrom(src => src.WorkOrders.Count(wo => wo.Status != "Done")))
                .ForMember(props => props.LastTelemetryRead,
                    confg => confg.MapFrom(src => src.TelemetryReads.OrderByDescending(t => t.Timestamp).FirstOrDefault() != null 
                        ? src.TelemetryReads.OrderByDescending(t => t.Timestamp).First().Timestamp 
                        : (DateTime?)null));

            // Machine → MachineDetailDto (for details page)
            CreateMap<Machine, MachineDetailDto>()
                .ForMember(props => props.TotalWorkOrders,
                    confg => confg.MapFrom(src => src.WorkOrders.Count))
                .ForMember(props => props.OpenWorkOrders,
                    confg => confg.MapFrom(src => src.WorkOrders.Count(wo => wo.Status != "Done")))
                .ForMember(props => props.LatestTelemetry,
                    confg => confg.MapFrom(src => src.TelemetryReads.OrderByDescending(t => t.Timestamp).Take(10)))
                .ForMember(props => props.RecentIncidents,
                    confg => confg.MapFrom(src => src.Incidents.OrderByDescending(i => i.TriggeredAt).Take(5)))
                .ForMember(props => props.ActiveAlerts,
                    confg => confg.MapFrom(src => src.Incidents.Where(i => i.Status == "Active").Take(5)));

            // TelemetryRead → TelemetryReadDto
            CreateMap<TelemetryRead, TelemetryReadDto>();

            // Incident → IncidentDto
            CreateMap<Incident, IncidentDto>();
        }
    }
}
