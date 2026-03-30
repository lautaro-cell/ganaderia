using Grpc.Core;
using Google.Protobuf.WellKnownTypes;
using GestorGanadero.Server.Application.Interfaces;
using GestorGanadero.Server.Application.DTOs;
using GestorGanadero.Services.Operations.Contracts;
using GestorGanadero.Services.Common.Contracts;
using Microsoft.Extensions.Logging;
using System.Linq;
using System.Threading.Tasks;
using System;

namespace GestorGanadero.Server.Grpc;

public class OperationsServiceImplementation : OperationsService.OperationsServiceBase
{
    private readonly ILivestockEventService _livestockEventService;
    private readonly ILogger<OperationsServiceImplementation> _logger;

    public OperationsServiceImplementation(ILivestockEventService livestockEventService, ILogger<OperationsServiceImplementation> logger)
    {
        _livestockEventService = livestockEventService;
        _logger = logger;
    }

    public override Task<EventTemplateList> GetEventTemplates(GetTemplatesRequest request, ServerCallContext context)
    {
        var templates = new EventTemplateList();
        templates.Templates.AddRange(new[]
        {
            new EventTemplate { Id = "template-nacimiento", Name = "Nacimiento",        Icon = "child_care",                  ColorCode = "#27ae60", Fields = { "head_count", "weight_per_head" } },
            new EventTemplate { Id = "template-destete",    Name = "Destete",           Icon = "transfer_within_a_station",    ColorCode = "#2980b9", Fields = { "head_count", "weight_per_head" } },
            new EventTemplate { Id = "template-mortandad",  Name = "Mortandad",         Icon = "crisis_alert",                ColorCode = "#c0392b", Fields = { "head_count" } },
            new EventTemplate { Id = "template-pesaje",     Name = "Pesaje de Control", Icon = "monitor_weight",              ColorCode = "#e67e22", Fields = { "head_count", "weight_per_head" } },
            new EventTemplate { Id = "template-venta",      Name = "Venta",             Icon = "sell",                        ColorCode = "#8e44ad", Fields = { "head_count", "weight_per_head" } }
        });
        return Task.FromResult(templates);
    }

    public override async Task<ActionResponse> RegisterEvent(RegisterEventRequest request, ServerCallContext context)
    {
        try
        {
            var appRequest = new CreateLivestockEventRequest(
                Guid.Parse(request.TemplateId),
                string.IsNullOrEmpty(request.FieldId) ? Guid.Empty : Guid.Parse(request.FieldId),
                request.HeadCount,
                (decimal)request.PrimaryValue,
                0,
                request.OccurredOn.ToDateTimeOffset()
            );

            var resultId = await _livestockEventService.CreateEventAsync(appRequest);
            return new ActionResponse { Success = true, Message = "Evento registrado.", ObjectId = resultId.ToString() };
        }
        catch (Exception ex)
        {
            throw new RpcException(new Status(StatusCode.Internal, ex.Message));
        }
    }

    public override async Task<ActionResponse> UpdateEvent(UpdateEventRequest request, ServerCallContext context)
    {
        await _livestockEventService.UpdateEventAsync(new UpdateEventRequestDto(
            Guid.Parse(request.Id), request.OccurredOn.ToDateTimeOffset(), request.HeadCount, 
            string.IsNullOrEmpty(request.WeightPerHead) ? 0 : decimal.Parse(request.WeightPerHead), (decimal)request.PrimaryValue, request.Observations));
        return new ActionResponse { Success = true, Message = "Evento actualizado." };
    }

    public override async Task<ActionResponse> DeleteEvent(DeleteEventRequest request, ServerCallContext context)
    {
        await _livestockEventService.DeleteEventAsync(Guid.Parse(request.Id));
        return new ActionResponse { Success = true, Message = "Evento eliminado." };
    }

    public override async Task<EventList> GetEvents(GetEventsRequest request, ServerCallContext context)
    {
        var events = await _livestockEventService.GetEventsAsync(null, request.StartDate?.ToDateTimeOffset(), request.EndDate?.ToDateTimeOffset());
        var response = new EventList();
        response.Events.AddRange(events.Select(e => new EventDetail
        {
            Id            = e.Id.ToString(),
            OccurredOn    = Timestamp.FromDateTimeOffset(e.EventDate),
            HeadCount     = e.HeadCount,
            TotalWeight   = (double)e.EstimatedWeightKg,
            TypeName      = e.TypeName,
            FieldName     = e.FieldName,
            WeightPerHead = e.WeightPerHead.ToString()
        }));
        return response;
    }

    public override async Task<EventDetail> GetEventDetails(GetEventDetailsRequest request, ServerCallContext context)
    {
        var e = await _livestockEventService.GetEventDetailsAsync(Guid.Parse(request.Id));
        return new EventDetail
        {
            Id = e.Id.ToString(),
            TypeName = e.TypeName,
            OccurredOn = Timestamp.FromDateTimeOffset(e.OccurredOn),
            FieldName = e.FieldName,
            HeadCount = e.HeadCount,
            WeightPerHead = e.WeightPerHead.ToString(),
            TotalWeight = (double)e.TotalWeight,
            Observations = e.Observations ?? "",
            TypeCode = e.TypeCode
        };
    }
}
