using AutoMapper;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Models;
using System.Text.Json;

namespace SmartFactoryCMMS.Api.Mappers
{
    public class MachineMappingProfile : Profile
    {
        public MachineMappingProfile() 
        {
            CreateMap<UpdateMachineDto, Machine>()
                .ForMember(dest => dest.StaticProperties, opt => opt.MapFrom((src, dest) => 
                    JsonSerializer.Serialize(new { src.NormTemp, src.BaseVib, src.NormPower })))
                .ForMember(dest => dest.Icon, opt => opt.MapFrom((src, dest) =>
                    string.IsNullOrEmpty(src.Icon) ? dest.Icon ?? "PrecisionManufacturing" : src.Icon));

            // Machine → MachineListDto (for table view)
            CreateMap<Machine, MachineListDto>()
                .ForMember(props => props.ActiveWorkOrdersCount,
                    confg => confg.MapFrom(src => src.WorkOrders.Count(wo => wo.Status != "Done")));

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
            
            CreateMap<Machine, MachineProductionLineDto>()
            .ForMember(dest => dest.ActiveAlerts, 
                opt => opt.MapFrom(src => src.Incidents.Where(i => i.Status == "Active")));

            CreateMap<CreateMachineDto, Machine>()
                .ForMember(dest => dest.StaticProperties, opt => opt.MapFrom((src, dest) => 
                    JsonSerializer.Serialize(new { src.NormTemp, src.BaseVib, src.NormPower})))
                .ForMember(dest => dest.Icon, opt => opt.MapFrom(src =>
                    string.IsNullOrEmpty(src.Icon) ? "PrecisionManufacturing" : src.Icon));
            
            CreateMap<CreateAlertThresholdDto, AlertThreshold>().ReverseMap();
            // TelemetryRead → TelemetryReadDto
            CreateMap<TelemetryRead, TelemetryReadDto>();

            // Incident → IncidentDto
            CreateMap<Incident, IncidentDto>();

            CreateMap<Incident, AlertDto>()
                .ForMember(dest => dest.Acknowledged,
                    opt => opt.MapFrom(src => src.Status != "Active"));                
        }
    }
}
