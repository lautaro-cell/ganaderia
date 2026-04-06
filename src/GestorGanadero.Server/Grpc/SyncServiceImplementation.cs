using Grpc.Core;
using Google.Protobuf.WellKnownTypes;
using GestorGanadero.Server.Application.Interfaces;
using GestorGanadero.Services.Sync.Contracts;
using Microsoft.Extensions.Logging;
using System.Linq;
using System.Threading.Tasks;
using System;
using System.Text.Json;
using System.Collections.Generic;

namespace GestorGanadero.Server.Grpc;

public class SyncServiceImplementation : SyncService.SyncServiceBase
{
    private readonly ILivestockEventService _livestockEventService;
    private readonly IERPProvider _erpProvider;
    private readonly ITenantProvider _tenantProvider;
    private readonly ILogger<SyncServiceImplementation> _logger;

    public SyncServiceImplementation(ILivestockEventService livestockEventService, IERPProvider erpProvider, ITenantProvider tenantProvider, ILogger<SyncServiceImplementation> logger)
    {
        _livestockEventService = livestockEventService;
        _erpProvider = erpProvider;
        _tenantProvider = tenantProvider;
        _logger = logger;
    }

    public override async Task<PendingSyncList> GetPendingSyncEvents(PendingSyncFilter request, ServerCallContext context)
    {
        var pending = await _livestockEventService.GetPendingEventsAsync();
        var response = new PendingSyncList();
        response.Entries.AddRange(pending.Select(e => new SyncEntry
        {
            Id = e.Id.ToString(),
            Date = Timestamp.FromDateTimeOffset(e.EventDate),
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
        var tenantId = _tenantProvider.TenantId;
        var logMessages = new List<string>();
        var syncedCount = 0;

        try
        {
            var accounts = await _erpProvider.GetAccountsAsync(tenantId);
            var costCenters = await _erpProvider.GetCostCentersAsync(tenantId);
            var categories = await _erpProvider.GetAnimalCategoriesAsync(tenantId);

            logMessages.Add($"ERP data fetched: {accounts.RootElement.GetArrayLength()} accounts, {costCenters.RootElement.GetArrayLength()} cost centers, {categories.RootElement.GetArrayLength()} categories");

            foreach (var entryId in request.EntryIds)
            {
                if (Guid.TryParse(entryId, out var eventId))
                {
                    var erpRef = await _livestockEventService.CommitToErpAsync(new[] { eventId });
                    syncedCount++;
                    logMessages.Add($"Event {entryId} synced: {erpRef}");
                }
                else
                {
                    logMessages.Add($"Invalid event ID: {entryId}");
                }
            }

            logMessages.Add($"Sincronización completada: {syncedCount}/{request.EntryIds.Count} eventos sincronizados.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during ERP sync");
            logMessages.Add($"Error: {ex.Message}");
        }

        return new SyncResult { Count = syncedCount, Log = string.Join(" | ", logMessages) };
    }
}
