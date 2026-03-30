using Grpc.Core;
using Google.Protobuf.WellKnownTypes;
using GestorGanadero.Server.Application.Interfaces;
using GestorGanadero.Services.Sync.Contracts;
using GestorGanadero.Services.Reporting.Contracts;
using Microsoft.Extensions.Logging;
using System.Linq;
using System.Threading.Tasks;

namespace GestorGanadero.Server.Grpc;

public class SyncServiceImplementation : SyncService.SyncServiceBase
{
    private readonly ILivestockEventService _livestockEventService;
    private readonly ILogger<SyncServiceImplementation> _logger;

    public SyncServiceImplementation(ILivestockEventService livestockEventService, ILogger<SyncServiceImplementation> logger)
    {
        _livestockEventService = livestockEventService;
        _logger = logger;
    }

    public override async Task<PendingSyncList> GetPendingSyncEvents(PendingSyncFilter request, ServerCallContext context)
    {
        var pending = await _livestockEventService.GetPendingEventsAsync();
        var response = new PendingSyncList();
        response.Entries.AddRange(pending.Select(e => new LedgerEntry 
        { 
            Id = e.Id.ToString(), Date = Timestamp.FromDateTimeOffset(e.EventDate), 
            Description = "Evento Pendiente", Amount = (double)e.TotalAmount, Status = e.Status 
        }));
        return response;
    }

    public override Task<SyncResult> SyncToERP(SyncRequest request, ServerCallContext context)
    {
        return Task.FromResult(new SyncResult { Count = request.EntryIds.Count, Log = "Sincronización masiva completada (Mock)." });
    }
}
