using Grpc.Core;
using Google.Protobuf.WellKnownTypes;
using App.Application.Interfaces;
using App.Application.DTOs;
using GestorGanadero.Services.Operations.Contracts;
using GestorGanadero.Services.Common.Contracts;
using Microsoft.Extensions.Logging;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using System;
using NodaTime;

namespace GestorGanadero.Server.Grpc;

public class OperationsServiceImplementation : OperationsService.OperationsServiceBase
{
    private readonly ILivestockEventService _livestockEventService;
    private readonly ICatalogService _catalogService;
    private readonly ILogger<OperationsServiceImplementation> _logger;

    public OperationsServiceImplementation(
        ILivestockEventService livestockEventService,
        ICatalogService catalogService,
        ILogger<OperationsServiceImplementation> logger)
    {
        _livestockEventService = livestockEventService;
        _catalogService = catalogService;
        _logger = logger;
    }

    public override async Task<EventTemplateList> GetEventTemplates(GetTemplatesRequest request, ServerCallContext context)
    {
        var tenantId = string.IsNullOrEmpty(request.TenantId) ? Guid.Empty : Guid.Parse(request.TenantId);
        if (tenantId == Guid.Empty) return new EventTemplateList();

        var eventTypes = await _catalogService.GetEventTypesAsync(tenantId);
        var response = new EventTemplateList();
        foreach (var t in eventTypes.Where(t => t.IsActive))
        {
            bool configured = !string.IsNullOrWhiteSpace(t.DebitAccountCode)
                           && !string.IsNullOrWhiteSpace(t.CreditAccountCode);
            var et = new EventTemplate
            {
                Id                        = t.Id.ToString(),
                Name                      = t.Name,
                Code                      = t.Code,
                Icon                      = GetIconForEventCode(t.Code),
                ColorCode                 = GetColorForEventCode(t.Code),
                IsConfigured              = configured,
                RequiresOriginDestination = t.RequiresOriginDestination,
                RequiresDestinationField  = t.RequiresDestinationField,
                DebitAccountCode          = t.DebitAccountCode ?? "",
                CreditAccountCode         = t.CreditAccountCode ?? "",
            };
            et.Fields.AddRange(BuildFieldsList(t.RequiresOriginDestination, t.RequiresDestinationField));
            response.Templates.Add(et);
        }
        return response;
    }

    private static IEnumerable<string> BuildFieldsList(bool requiresOriginDestination, bool requiresDestinationField)
    {
        var fields = new List<string> { "head_count", "weight_per_head", "field_id", "observations" };
        if (requiresOriginDestination)
        {
            fields.Add("activity_origin_id");
            fields.Add("category_origin_id");
            fields.Add("activity_destination_id");
            fields.Add("category_destination_id");
        }
        if (requiresDestinationField)
            fields.Add("field_destination_id");
        return fields;
    }

    private static string GetIconForEventCode(string code)
    {
        var c = (code ?? "").ToLowerInvariant();
        if (c.Contains("nac")) return "child_care";
        if (c.Contains("comp")) return "add_shopping_cart";
        if (c.Contains("vent")) return "sell";
        if (c.Contains("mort") || c.Contains("muer")) return "crisis_alert";
        if (c.Contains("san")) return "medical_services";
        if (c.Contains("alim")) return "restaurant";
        if (c.Contains("pes") || c.Contains("peso")) return "monitor_weight";
        if (c.Contains("mov") || c.Contains("tras")) return "transfer_within_a_station";
        if (c.Contains("dest")) return "crib";
        if (c.Contains("comp")) return "compare_arrows";
        return "event";
    }

    private static string GetColorForEventCode(string code)
    {
        var c = (code ?? "").ToLowerInvariant();
        if (c.Contains("nac")) return "#27ae60";
        if (c.Contains("comp")) return "#2980b9";
        if (c.Contains("vent")) return "#8e44ad";
        if (c.Contains("mort") || c.Contains("muer")) return "#c0392b";
        if (c.Contains("san")) return "#e74c3c";
        if (c.Contains("alim")) return "#f39c12";
        if (c.Contains("pes") || c.Contains("peso")) return "#e67e22";
        if (c.Contains("mov") || c.Contains("tras")) return "#16a085";
        if (c.Contains("dest")) return "#1abc9c";
        return "#95a5a6";
    }

    public override async Task<ActionResponse> RegisterEvent(RegisterEventRequest request, ServerCallContext context)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            var appRequest = new CreateLivestockEventRequest(
                Guid.Parse(request.TemplateId),
                string.IsNullOrEmpty(request.FieldId) ? "" : request.FieldId,
                request.HeadCount,
                (decimal)request.PrimaryValue,
                0,
                Instant.FromDateTimeOffset(request.OccurredOn.ToDateTimeOffset())
            );

            var resultId = await _livestockEventService.CreateEventAsync(appRequest);
            _logger.LogInformation("RegisterEvent completed | Duration={DurationMs}ms | EventId={EventId}",
                sw.ElapsedMilliseconds, resultId);
            return new ActionResponse { Success = true, Message = "Evento registrado.", ObjectId = resultId.ToString() };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "RegisterEvent failed | Duration={DurationMs}ms", sw.ElapsedMilliseconds);
            throw new RpcException(new Status(StatusCode.Internal, ex.Message));
        }
    }

    public override async Task<ActionResponse> UpdateEvent(UpdateEventRequest request, ServerCallContext context)
    {
        await _livestockEventService.UpdateEventAsync(new UpdateEventRequestDto(
            Guid.Parse(request.Id), Instant.FromDateTimeOffset(request.OccurredOn.ToDateTimeOffset()), request.HeadCount, 
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
        var sw = Stopwatch.StartNew();
        var tenantId = string.IsNullOrEmpty(request.TenantId) ? (Guid?)null : Guid.Parse(request.TenantId);
        var start = request.StartDate == null ? (Instant?)null : Instant.FromDateTimeOffset(request.StartDate.ToDateTimeOffset());
        var end   = request.EndDate   == null ? (Instant?)null : Instant.FromDateTimeOffset(request.EndDate.ToDateTimeOffset());

        int pageSize  = request.PageSize  > 0 ? request.PageSize  : 20;
        int pageIndex = request.PageIndex >= 0 ? request.PageIndex : 0;

        var (items, total) = await _livestockEventService.GetEventsPagedAsync(tenantId, start, end, pageIndex, pageSize);

        var response = new EventList { TotalCount = total };
        response.Events.AddRange(items.Select(e => new EventDetail
        {
            Id            = e.Id.ToString(),
            OccurredOn    = Timestamp.FromDateTimeOffset(e.EventDate.ToDateTimeOffset()),
            HeadCount     = e.HeadCount,
            TotalWeight   = (double)e.EstimatedWeightKg,
            TypeName      = e.TypeName ?? "",
            FieldName     = e.FieldName ?? "",
            WeightPerHead = (double)e.WeightPerHead
        }));

        _logger.LogInformation("GetEvents | TenantId={TenantId} | Page={Page}/{TotalPages} | Count={Count} | Duration={DurationMs}ms",
            request.TenantId, pageIndex, (int)Math.Ceiling((double)total / pageSize), items.Count, sw.ElapsedMilliseconds);

        return response;
    }
}
