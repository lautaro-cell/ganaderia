using Grpc.Core;
using Google.Protobuf.WellKnownTypes;
using GestorGanadero.Server.Application.Interfaces;
using GestorGanadero.Server.Application.DTOs;
using GestorGanadero.Grpc.V1;
using Microsoft.Extensions.Logging;
using GestorGanadero.Server.Domain.Enums;

namespace GestorGanadero.Server.Grpc;

public class LivestockServiceImplementation : LivestockService.LivestockServiceBase
{
    private readonly ILivestockEventService _livestockEventService;
    private readonly ICatalogService _catalogService;
    private readonly ILoteService _loteService;
    private readonly IUserService _userService;
    private readonly IReportService _reportService;
    private readonly ILogger<LivestockServiceImplementation> _logger;

    public LivestockServiceImplementation(
        ILivestockEventService livestockEventService,
        ICatalogService catalogService,
        ILoteService loteService,
        IUserService userService,
        IReportService reportService,
        ILogger<LivestockServiceImplementation> logger)
    {
        _livestockEventService = livestockEventService;
        _catalogService = catalogService;
        _loteService = loteService;
        _userService = userService;
        _reportService = reportService;
        _logger = logger;
    }

    // --- AUTH & PROFILE ---
    public override async Task<UserProfile> GetMyProfile(Empty request, ServerCallContext context)
    {
        var profile = await _userService.GetMyProfileAsync();
        return new UserProfile
        {
            Id = profile.Id.ToString(),
            Email = profile.Email,
            Name = profile.Email.Split('@')[0],
            Role = profile.Role.ToString(),
            ActiveTenantId = profile.TenantId.ToString()
        };
    }

    public override async Task<TenantList> GetAvailableTenants(Empty request, ServerCallContext context)
    {
        var tenants = await _userService.GetAvailableTenantsAsync();
        var response = new TenantList();
        response.Tenants.AddRange(tenants.Select(t => new TenantMessage { Id = t.Id.ToString(), Name = t.Name }));
        return response;
    }

    // --- EVENT TEMPLATES & REGISTRATION ---
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
                request.FieldId,
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
            decimal.Parse(request.WeightPerHead), (decimal)request.PrimaryValue, request.Observations));
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

    // --- REPORTS ---
    public override async Task<BalanceReport> GetBalance(GetBalanceRequest request, ServerCallContext context)
    {
        var balance = await _reportService.GetBalanceAsync(
            string.IsNullOrEmpty(request.FieldId) ? null : Guid.Parse(request.FieldId),
            request.Date?.ToDateTime(),
            request.CategoryView);

        var response = new BalanceReport { ReportDate = request.Date ?? Timestamp.FromDateTime(DateTime.UtcNow) };
        response.Items.AddRange(balance.Select(b => new BalanceItem
        {
            FieldName = b.FieldName,
            CategoryName = b.CategoryName,
            HeadCount = b.HeadCount,
            TotalWeight = (double)b.TotalWeight,
            ActivityName = b.ActivityName
        }));
        return response;
    }

    // --- CATALOGS: FIELDS ---
    public override async Task<FieldList> GetFields(GetCatalogRequest request, ServerCallContext context)
    {
        var fields = await _catalogService.GetFieldsAsync();
        var response = new FieldList();
        response.Fields.AddRange(fields.Select(f => new FieldMessage { Id = f.Id.ToString(), Name = f.Name, Description = f.Description, IsActive = f.IsActive, TenantId = f.TenantId.ToString() }));
        return response;
    }

    public override async Task<ActionResponse> CreateField(FieldMessage request, ServerCallContext context)
    {
        var id = await _catalogService.CreateFieldAsync(new FieldDto(Guid.Empty, request.Name, request.Description, request.IsActive, Guid.Empty));
        return new ActionResponse { Success = true, ObjectId = id.ToString() };
    }

    public override async Task<ActionResponse> UpdateField(FieldMessage request, ServerCallContext context)
    {
        await _catalogService.UpdateFieldAsync(new FieldDto(Guid.Parse(request.Id), request.Name, request.Description, request.IsActive, Guid.Empty));
        return new ActionResponse { Success = true, Message = "Campo actualizado." };
    }

    public override async Task<ActionResponse> DeleteField(DeleteEntityRequest request, ServerCallContext context)
    {
        await _catalogService.DeleteFieldAsync(Guid.Parse(request.Id));
        return new ActionResponse { Success = true, Message = "Campo eliminado." };
    }

    // --- CATALOGS: ACTIVITIES ---
    public override async Task<ActivityList> GetActivities(GetCatalogRequest request, ServerCallContext context)
    {
        var activities = await _catalogService.GetActivitiesAsync();
        var response = new ActivityList();
        response.Activities.AddRange(activities.Select(a => new ActivityMessage { Id = a.Id.ToString(), Name = a.Name, IsGlobal = a.IsGlobal, TenantId = a.TenantId?.ToString() ?? "" }));
        return response;
    }

    public override async Task<ActionResponse> CreateActivity(ActivityMessage request, ServerCallContext context)
    {
        var id = await _catalogService.CreateActivityAsync(new ActivityDto(Guid.Empty, request.Name, request.IsGlobal, Guid.Empty));
        return new ActionResponse { Success = true, ObjectId = id.ToString() };
    }

    public override async Task<ActionResponse> UpdateActivity(ActivityMessage request, ServerCallContext context)
    {
        await _catalogService.UpdateActivityAsync(new ActivityDto(Guid.Parse(request.Id), request.Name, request.IsGlobal, Guid.Empty));
        return new ActionResponse { Success = true, Message = "Actividad actualizada." };
    }

    public override async Task<ActionResponse> DeleteActivity(DeleteEntityRequest request, ServerCallContext context)
    {
        await _catalogService.DeleteActivityAsync(Guid.Parse(request.Id));
        return new ActionResponse { Success = true, Message = "Actividad eliminada." };
    }

    // --- CATALOGS: ANIMAL CATEGORIES ---
    public override async Task<AnimalCategoryList> GetAnimalCategories(GetCatalogRequest request, ServerCallContext context)
    {
        var categories = await _catalogService.GetCategoriesAsync();
        var response = new AnimalCategoryList();
        response.Categories.AddRange(categories.Select(c => new AnimalCategoryMessage 
        { 
            Id = c.Id.ToString(), Name = c.Name, ActivityId = c.ActivityId.ToString(), 
            StandardWeightKg = c.StandardWeightKg.ToString(), CategoryType = c.CategoryType, 
            ExternalId = c.ExternalId ?? "", IsActive = c.IsActive, TenantId = c.TenantId?.ToString() ?? "" 
        }));
        return response;
    }

    public override async Task<ActionResponse> CreateAnimalCategory(AnimalCategoryMessage request, ServerCallContext context)
    {
        var id = await _catalogService.CreateCategoryAsync(new AnimalCategoryDto(
            Guid.Empty, request.Name, Guid.Parse(request.ActivityId), decimal.Parse(request.StandardWeightKg), 
            request.CategoryType, request.ExternalId, request.IsActive, null));
        return new ActionResponse { Success = true, ObjectId = id.ToString() };
    }

    public override async Task<ActionResponse> UpdateAnimalCategory(AnimalCategoryMessage request, ServerCallContext context)
    {
        await _catalogService.UpdateCategoryAsync(new AnimalCategoryDto(
            Guid.Parse(request.Id), request.Name, Guid.Parse(request.ActivityId), decimal.Parse(request.StandardWeightKg), 
            request.CategoryType, request.ExternalId, request.IsActive, null));
        return new ActionResponse { Success = true, Message = "Categoría actualizada." };
    }

    public override async Task<ActionResponse> DeleteAnimalCategory(DeleteEntityRequest request, ServerCallContext context)
    {
        await _catalogService.DeleteCategoryAsync(Guid.Parse(request.Id));
        return new ActionResponse { Success = true, Message = "Categoría eliminada." };
    }

    // --- LOTES ---
    public override async Task<LoteList> GetLotes(GetLotesRequest request, ServerCallContext context)
    {
        var lotes = await _loteService.GetLotesByFieldAsync(Guid.Parse(request.FieldId));
        var response = new LoteList();
        response.Lotes.AddRange(lotes.Select(l => new LoteMessage { Id = l.Id.ToString(), Name = l.Name, FieldId = l.FieldId.ToString(), FieldName = l.FieldName, ActivityIds = { l.ActivityIds.Select(id => id.ToString()) } }));
        return response;
    }

    public override async Task<ActionResponse> CreateLote(LoteMessage request, ServerCallContext context)
    {
        var id = await _loteService.CreateLoteAsync(new LoteDto(Guid.Empty, request.Name, Guid.Parse(request.FieldId), request.ActivityIds.Select(Guid.Parse), null));
        return new ActionResponse { Success = true, ObjectId = id.ToString() };
    }

    public override async Task<ActionResponse> UpdateLote(LoteMessage request, ServerCallContext context)
    {
        await _loteService.UpdateLoteAsync(new LoteDto(Guid.Parse(request.Id), request.Name, Guid.Parse(request.FieldId), request.ActivityIds.Select(Guid.Parse), null));
        return new ActionResponse { Success = true, Message = "Lote actualizado." };
    }

    public override async Task<ActionResponse> DeleteLote(DeleteEntityRequest request, ServerCallContext context)
    {
        await _loteService.DeleteLoteAsync(Guid.Parse(request.Id));
        return new ActionResponse { Success = true, Message = "Lote eliminado." };
    }

    public override async Task<ActionResponse> SaveLoteGeometria(LoteGeoRequest request, ServerCallContext context)
    {
        await _loteService.SaveGeometryAsync(Guid.Parse(request.LoteId), request.GeojsonPolygon);
        return new ActionResponse { Success = true, Message = "Geometría guardada." };
    }

    // --- ADMIN: USERS ---
    public override async Task<UserList> GetUsers(Empty request, ServerCallContext context)
    {
        var users = await _userService.GetAllUsersAsync();
        var response = new UserList();
        response.Users.AddRange(users.Select(u => new UserMessage { Id = u.Id.ToString(), Email = u.Email, RoleName = u.Role.ToString(), TenantId = u.TenantId.ToString(), IsActive = true }));
        return response;
    }

    public override async Task<ActionResponse> InviteUser(GestorGanadero.Grpc.V1.InviteUserRequest request, ServerCallContext context)
    {
        var id = await _userService.InviteUserAsync(new GestorGanadero.Server.Application.DTOs.InviteUserRequest(request.Email, request.Name, request.RoleName, Guid.Parse(request.TenantId)));
        return new ActionResponse { Success = true, ObjectId = id.ToString() };
    }

    public override async Task<ActionResponse> UpdateUser(UserMessage request, ServerCallContext context)
    {
        await _userService.UpdateUserAsync(new UserDto(Guid.Parse(request.Id), request.Email, Guid.Parse(request.TenantId), System.Enum.Parse<UserRole>(request.RoleName)));
        return new ActionResponse { Success = true, Message = "Usuario actualizado." };
    }

    public override async Task<ActionResponse> DeleteUser(DeleteEntityRequest request, ServerCallContext context)
    {
        await _userService.DeleteUserAsync(Guid.Parse(request.Id));
        return new ActionResponse { Success = true, Message = "Usuario eliminado." };
    }

    // --- LEDGER & SYNC ---
    public override async Task GetLedger(LedgerFilter request, IServerStreamWriter<LedgerEntry> responseStream, ServerCallContext context)
    {
        // Placeholder for ledger streaming
        await responseStream.WriteAsync(new LedgerEntry { Id = Guid.NewGuid().ToString(), Description = "Mock Ledger Entry", Amount = 100 });
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
