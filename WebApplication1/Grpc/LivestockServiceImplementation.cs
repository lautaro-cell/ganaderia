using Grpc.Core;
using Google.Protobuf.WellKnownTypes;
using WebApplication1.Application.Interfaces;
using WebApplication1.Application.DTOs;
using GestorGanadero.Grpc.V1;
using System.Globalization;
using Microsoft.Extensions.Logging;

namespace WebApplication1.Grpc;

public class LivestockServiceImplementation : LivestockService.LivestockServiceBase
{
    private readonly ILivestockEventService _livestockEventService;
    private readonly ITranslationService _translationService;
    private readonly ILogger<LivestockServiceImplementation> _logger;

    public LivestockServiceImplementation(
        ILivestockEventService livestockEventService,
        ITranslationService translationService,
        ILogger<LivestockServiceImplementation> logger)
    {
        _livestockEventService = livestockEventService;
        _translationService = translationService;
        _logger = logger;
    }

    public override Task<EventTemplateList> GetEventTemplates(GetTemplatesRequest request, ServerCallContext context)
    {
        _logger.LogInformation("Fetching event templates for tenant {TenantId}", request.TenantId);

        var templates = new EventTemplateList();
        templates.Templates.AddRange(new[]
        {
            new EventTemplate 
            { 
                Id = "template-nacimiento", 
                Name = "Nacimiento", 
                Icon = "baby", 
                ColorCode = "#52c41a",
                Fields = { "Peso al Nacer", "Id Madre", "Sexo" }
            },
            new EventTemplate 
            { 
                Id = "template-destete", 
                Name = "Destete", 
                Icon = "swap", 
                ColorCode = "#1890ff",
                Fields = { "Peso Destete", "Lote Destino" }
            },
            new EventTemplate 
            { 
                Id = "template-mortandad", 
                Name = "Mortandad", 
                Icon = "frown", 
                ColorCode = "#f5222d",
                Fields = { "Causa", "Observaciones" }
            }
        });

        return Task.FromResult(templates);
    }

    public override async Task<ActionResponse> RegisterEvent(RegisterEventRequest request, ServerCallContext context)
    {
        _logger.LogInformation("Registering event for template {TemplateId}", request.TemplateId);

        if (string.IsNullOrWhiteSpace(request.AnimalId))
        {
            _logger.LogWarning("RegisterEvent failed: animal_id is empty");
            throw new RpcException(new Status(StatusCode.InvalidArgument, "animal_id cannot be empty."));
        }

        try
        {
            if (!Guid.TryParse(request.TemplateId, out var templateId))
            {
                // For mocks, we might allow the mock IDs
                if (request.TemplateId.StartsWith("template-"))
                {
                    return new ActionResponse { Success = true, Message = "Evento registrado (Mock Success)", ObjectId = Guid.NewGuid().ToString() };
                }
                throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid TemplateId format."));
            }

            var appRequest = new CreateLivestockEventRequest(
                templateId,
                "CC_MOCK", // Hardcoded for simplified mock
                1,
                (decimal)request.PrimaryValue,
                0, // Amount to be determined by translation or additional data
                request.OccurredOn.ToDateTimeOffset()
            );

            var resultId = await _livestockEventService.CreateEventAsync(appRequest);

            return new ActionResponse 
            { 
                Success = true, 
                Message = "Evento registrado exitosamente.", 
                ObjectId = resultId.ToString() 
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error registering event");
            throw new RpcException(new Status(StatusCode.Internal, ex.Message));
        }
    }

    public override async Task GetLedger(LedgerFilter request, IServerStreamWriter<LedgerEntry> responseStream, ServerCallContext context)
    {
        _logger.LogInformation("Streaming ledger entries...");

        // Mock data for Ledger
        var mockEntries = new List<LedgerEntry>
        {
            new LedgerEntry 
            { 
                Id = Guid.NewGuid().ToString(), 
                Date = Timestamp.FromDateTime(DateTime.UtcNow.AddDays(-1)), 
                Description = "Compra de Vaquillonas", 
                Amount = 500000, 
                AccountCode = "1.1.05", 
                Status = "Audited" 
            },
            new LedgerEntry 
            { 
                Id = Guid.NewGuid().ToString(), 
                Date = Timestamp.FromDateTime(DateTime.UtcNow.AddDays(-2)), 
                Description = "Venta Novillos", 
                Amount = 1200000, 
                AccountCode = "5.2.03", 
                Status = "Synced" 
            }
        };

        foreach (var entry in mockEntries)
        {
            await responseStream.WriteAsync(entry);
        }
    }

    public override Task<PendingSyncList> GetPendingSyncEvents(PendingSyncFilter request, ServerCallContext context)
    {
        var response = new PendingSyncList();
        // Return some mock pending entries
        response.Entries.Add(new LedgerEntry 
        { 
            Id = Guid.NewGuid().ToString(), 
            Date = Timestamp.FromDateTime(DateTime.UtcNow), 
            Description = "Nacimiento Lote 01", 
            Amount = 0, 
            AccountCode = "4.1.02", 
            Status = "Draft" 
        });
        return Task.FromResult(response);
    }

    public override Task<SyncResult> SyncToERP(SyncRequest request, ServerCallContext context)
    {
        _logger.LogInformation("Syncing {Count} entries to ERP", request.EntryIds.Count);
        return Task.FromResult(new SyncResult 
        { 
            Count = request.EntryIds.Count, 
            Log = "Sincronización masiva completada exitosamente (Mock)." 
        });
    }

    public override Task<ActionResponse> SaveLoteGeometria(LoteGeoRequest request, ServerCallContext context)
    {
        _logger.LogInformation("Saving geometry for lote {LoteId}", request.LoteId);
        return Task.FromResult(new ActionResponse 
        { 
            Success = true, 
            Message = "Geometría guardada correctamente (Mock PostGIS)." 
        });
    }

    // --- Catalog stubs: ready for real DB queries once EF migrations run ---

    public override Task<FieldList> GetFields(GetCatalogRequest request, ServerCallContext context)
    {
        _logger.LogInformation("Fetching fields for tenant {TenantId}", request.TenantId);
        var list = new FieldList();
        list.Fields.AddRange(new[]
        {
            new FieldMessage { Id = Guid.NewGuid().ToString(), Name = "Campo La Esperanza", Description = "Establecimiento norte", IsActive = true },
            new FieldMessage { Id = Guid.NewGuid().ToString(), Name = "Campo San Juan",     Description = "Establecimiento sur",   IsActive = true }
        });
        return Task.FromResult(list);
    }

    public override Task<ActivityList> GetActivities(GetCatalogRequest request, ServerCallContext context)
    {
        _logger.LogInformation("Fetching activities for tenant {TenantId}", request.TenantId);
        var list = new ActivityList();
        list.Activities.AddRange(new[]
        {
            new ActivityMessage { Id = Guid.NewGuid().ToString(), Name = "Cría",      IsGlobal = true },
            new ActivityMessage { Id = Guid.NewGuid().ToString(), Name = "Recría",    IsGlobal = true },
            new ActivityMessage { Id = Guid.NewGuid().ToString(), Name = "Invernada", IsGlobal = true }
        });
        return Task.FromResult(list);
    }

    public override Task<AnimalCategoryList> GetAnimalCategories(GetCatalogRequest request, ServerCallContext context)
    {
        _logger.LogInformation("Fetching animal categories for tenant {TenantId}", request.TenantId);
        var list = new AnimalCategoryList();
        list.Categories.AddRange(new[]
        {
            new AnimalCategoryMessage { Id = Guid.NewGuid().ToString(), Name = "Ternero",    StandardWeightKg = "180",  CategoryType = "Client", IsActive = true },
            new AnimalCategoryMessage { Id = Guid.NewGuid().ToString(), Name = "Novillito",  StandardWeightKg = "280",  CategoryType = "Client", IsActive = true },
            new AnimalCategoryMessage { Id = Guid.NewGuid().ToString(), Name = "Novillo",    StandardWeightKg = "400",  CategoryType = "Client", IsActive = true },
            new AnimalCategoryMessage { Id = Guid.NewGuid().ToString(), Name = "Vaquillona", StandardWeightKg = "320",  CategoryType = "Client", IsActive = true },
            new AnimalCategoryMessage { Id = Guid.NewGuid().ToString(), Name = "Vaca",       StandardWeightKg = "450",  CategoryType = "Client", IsActive = true }
        });
        return Task.FromResult(list);
    }
}
