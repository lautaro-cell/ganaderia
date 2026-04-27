using App.Application.Interfaces;
using GestorGanadero.Services.Sync.Contracts;
using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using Microsoft.Extensions.Logging;

namespace GestorGanadero.Server.Grpc;

public class SyncServiceImplementation : SyncService.SyncServiceBase
{
    private readonly ILivestockEventService _livestockEventService;
    private readonly ITenantProvider _tenantProvider;
    private readonly IErpSyncService _erpSyncService;
    private readonly ILogger<SyncServiceImplementation> _logger;

    public SyncServiceImplementation(
        ILivestockEventService livestockEventService,
        ITenantProvider tenantProvider,
        IErpSyncService erpSyncService,
        ILogger<SyncServiceImplementation> logger)
    {
        _livestockEventService = livestockEventService;
        _tenantProvider = tenantProvider;
        _erpSyncService = erpSyncService;
        _logger = logger;
    }

    public override async Task<SyncCatalogResponse> SyncCatalog(SyncCatalogRequest request, ServerCallContext context)
    {
        try
        {
            var tenantId = string.IsNullOrEmpty(request.TenantId)
                ? _tenantProvider.TenantId
                : Guid.Parse(request.TenantId);

            await _erpSyncService.SyncCatalogAsync(tenantId, context.CancellationToken);
            return new SyncCatalogResponse { Success = true, Message = "Sincronización completada exitosamente." };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing catalog from gRPC");
            return new SyncCatalogResponse { Success = false, Message = $"Error: {ex.Message}" };
        }
    }

    public override async Task<PendingSyncList> GetPendingSyncEvents(PendingSyncFilter request, ServerCallContext context)
    {
        var pending = await _livestockEventService.GetPendingEventsAsync();
        var response = new PendingSyncList();
        response.Entries.AddRange(pending.Select(e => new SyncEntry
        {
            Id = e.Id.ToString(),
            Date = Timestamp.FromDateTimeOffset(e.EventDate.ToDateTimeOffset()),
            Description = "Evento Pendiente",
            Amount = (double)e.TotalAmount,
            Status = e.Status,
            HeadCount = e.HeadCount,
            WeightKg = e.EstimatedWeightKg.ToString()
        }));
        return response;
    }

    public override async Task<SyncResult> SyncToERP(SyncRequest request, ServerCallContext context)
    {
        var logMessages = new List<string>();

        try
        {
            var eventIds = request.EntryIds
                .Select(id => Guid.TryParse(id, out var parsed) ? (Guid?)parsed : null)
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .Distinct()
                .ToList();

            if (eventIds.Count == 0)
                return new SyncResult { Count = 0, Log = "No se enviaron IDs válidos para sincronizar." };

            var erpRef = await _livestockEventService.CommitToErpAsync(eventIds);
            logMessages.Add($"Sincronización completada: {eventIds.Count}/{request.EntryIds.Count} eventos. Ref={erpRef}");
            return new SyncResult { Count = eventIds.Count, Log = string.Join(" | ", logMessages) };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during ERP sync");
            logMessages.Add($"Error: {ex.Message}");
            return new SyncResult { Count = 0, Log = string.Join(" | ", logMessages) };
        }
    }
}

