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

    public override async Task<EventTemplateList> GetEventTemplates(GetTemplatesRequest request, ServerCallContext context)
    {
        var tenantId = string.IsNullOrEmpty(request.TenantId) ? Guid.Empty : Guid.Parse(request.TenantId);
        if (tenantId == Guid.Empty)
        {
            return new EventTemplateList();
        }

        var templates = await _livestockEventService.GetEventTemplatesAsync(tenantId);
        var response = new EventTemplateList();
        response.Templates.AddRange(templates.Select(t => new EventTemplate
        {
            Id = t.Id.ToString(),
            Name = t.Name,
            Icon = GetIconForEventType(t.EventType.ToString()),
            ColorCode = GetColorForEventType(t.EventType.ToString()),
            Fields = { "head_count", "weight_per_head" }
        }));
        return response;
    }

    private static string GetIconForEventType(string eventType) => eventType switch
    {
        "Nacimiento" => "child_care",
        "Compra" => "add_shopping_cart",
        "Venta" => "sell",
        "Muerte" => "crisis_alert",
        "Sanidad" => "medical_services",
        "Alimentacion" => "restaurant",
        "Pesaje" => "monitor_weight",
        "Movimiento" => "transfer_within_a_station",
        _ => "event"
    };

    private static string GetColorForEventType(string eventType) => eventType switch
    {
        "Nacimiento" => "#27ae60",
        "Compra" => "#2980b9",
        "Venta" => "#8e44ad",
        "Muerte" => "#c0392b",
        "Sanidad" => "#e74c3c",
        "Alimentacion" => "#f39c12",
        "Pesaje" => "#e67e22",
        "Movimiento" => "#16a085",
        _ => "#95a5a6"
    };

    public override async Task<ActionResponse> RegisterEvent(RegisterEventRequest request, ServerCallContext context)
    {
        try
        {
            var appRequest = new CreateLivestockEventRequest(
                Guid.Parse(request.TemplateId),
                string.IsNullOrEmpty(request.FieldId) ? "" : request.FieldId,
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
            (decimal)request.WeightPerHead, (decimal)request.PrimaryValue, request.Observations));
        return new ActionResponse { Success = true, Message = "Evento actualizado." };
    }

    public override async Task<ActionResponse> DeleteEvent(DeleteEventRequest request, ServerCallContext context)
    {
        await _livestockEventService.DeleteEventAsync(Guid.Parse(request.Id));
        return new ActionResponse { Success = true, Message = "Evento eliminado." };
    }

    public override async Task<EventList> GetEvents(GetEventsRequest request, ServerCallContext context)
    {
        var tenantId = string.IsNullOrEmpty(request.TenantId) ? (Guid?)null : Guid.Parse(request.TenantId);
        var events = await _livestockEventService.GetEventsAsync(tenantId, request.StartDate?.ToDateTimeOffset(), request.EndDate?.ToDateTimeOffset());
        var response = new EventList();
        response.Events.AddRange(events.Select(e => new EventDetail
        {
            Id            = e.Id.ToString(),
            OccurredOn    = Timestamp.FromDateTimeOffset(e.EventDate),
            HeadCount     = e.HeadCount,
            TotalWeight   = (double)e.EstimatedWeightKg,
            TypeName      = e.TypeName,
            FieldName     = e.FieldName,
            WeightPerHead = (double)e.WeightPerHead
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
            WeightPerHead = (double)e.WeightPerHead,
            TotalWeight = (double)e.TotalWeight,
            Observations = e.Observations ?? "",
            TypeCode = e.TypeCode
        };
    }
}
