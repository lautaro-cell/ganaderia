using Grpc.Core;
using App.Application.Interfaces;
using App.Application.DTOs;
using GestorGanadero.Services.Catalog.Contracts;
using GestorGanadero.Services.Common.Contracts;
using Microsoft.Extensions.Logging;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using System;

namespace GestorGanadero.Server.Grpc;

public class CatalogServiceImplementation : CatalogService.CatalogServiceBase
{
    private readonly ICatalogService _catalogService;
    private readonly IErpAccountQueryService _erpAccountService;
    private readonly ILogger<CatalogServiceImplementation> _logger;

    public CatalogServiceImplementation(
        ICatalogService catalogService,
        IErpAccountQueryService erpAccountService,
        ILogger<CatalogServiceImplementation> logger)
    {
        _catalogService = catalogService;
        _erpAccountService = erpAccountService;
        _logger = logger;
    }

    public override async Task<FieldList> GetFields(GetCatalogRequest request, ServerCallContext context)
    {
        var sw = Stopwatch.StartNew();
        var fields = await _catalogService.GetFieldsAsync();
        var response = new FieldList();
        foreach (var f in fields)
        {
            var msg = new FieldMessage
            {
                Id = f.Id.ToString(), Name = f.Name, Description = f.Description ?? "",
                IsActive = f.IsActive, TenantId = f.TenantId.ToString(),
                LegalName = f.LegalName ?? "", AreaHectares = (double)(f.AreaHectares ?? 0),
                GpsLatitude = f.GpsLatitude ?? 0, GpsLongitude = f.GpsLongitude ?? 0
            };
            if (f.ActivityIds != null) msg.ActivityIds.AddRange(f.ActivityIds.Select(id => id.ToString()));
            response.Fields.Add(msg);
        }
        _logger.LogInformation("GetFields | Count={Count} | Duration={DurationMs}ms", response.Fields.Count, sw.ElapsedMilliseconds);
        return response;
    }

    private static FieldDto FieldFromProto(FieldMessage r)
    {
        var activityIds = r.ActivityIds.Select(id => Guid.Parse(id)).ToList();
        return new FieldDto(
            string.IsNullOrEmpty(r.Id) ? Guid.Empty : Guid.Parse(r.Id),
            r.Name, r.Description,
            r.IsActive,
            Guid.TryParse(r.TenantId, out var tid) ? tid : Guid.Empty,
            string.IsNullOrEmpty(r.LegalName) ? null : r.LegalName,
            r.AreaHectares > 0 ? (decimal?)r.AreaHectares : null,
            r.GpsLatitude != 0 ? r.GpsLatitude : null,
            r.GpsLongitude != 0 ? r.GpsLongitude : null,
            activityIds.Any() ? activityIds : null);
    }

    public override async Task<ActionResponse> CreateField(FieldMessage request, ServerCallContext context)
    {
        var id = await _catalogService.CreateFieldAsync(FieldFromProto(request));
        return new ActionResponse { Success = true, ObjectId = id.ToString() };
    }

    public override async Task<ActionResponse> UpdateField(FieldMessage request, ServerCallContext context)
    {
        await _catalogService.UpdateFieldAsync(FieldFromProto(request));
        return new ActionResponse { Success = true, Message = "Campo actualizado." };
    }

    public override async Task<ActionResponse> DeleteField(DeleteEntityRequest request, ServerCallContext context)
    {
        await _catalogService.DeleteFieldAsync(Guid.Parse(request.Id));
        return new ActionResponse { Success = true, Message = "Campo eliminado." };
    }

    public override async Task<ActivityList> GetActivities(GetCatalogRequest request, ServerCallContext context)
    {
        var sw = Stopwatch.StartNew();
        var activities = await _catalogService.GetActivitiesAsync();
        var response = new ActivityList();
        foreach (var a in activities)
        {
            var msg = new ActivityMessage
            {
                Id = a.Id.ToString(), Name = a.Name, IsGlobal = a.IsGlobal,
                TenantId = a.TenantId?.ToString() ?? "", Description = a.Description ?? ""
            };
            if (a.CategoryIds != null) msg.CategoryIds.AddRange(a.CategoryIds.Select(id => id.ToString()));
            response.Activities.Add(msg);
        }
        _logger.LogInformation("GetActivities | Count={Count} | Duration={DurationMs}ms", response.Activities.Count, sw.ElapsedMilliseconds);
        return response;
    }

    private static ActivityDto ActivityFromProto(ActivityMessage r)
    {
        var tid = string.IsNullOrEmpty(r.TenantId) ? (Guid?)null : Guid.Parse(r.TenantId);
        var catIds = r.CategoryIds.Select(Guid.Parse).ToList();
        var etIds  = r.EventTypeIds.Select(Guid.Parse).ToList();
        return new ActivityDto(
            string.IsNullOrEmpty(r.Id) ? Guid.Empty : Guid.Parse(r.Id),
            r.Name, r.IsGlobal, tid,
            string.IsNullOrEmpty(r.Description) ? null : r.Description,
            catIds.Any() ? catIds : null,
            etIds.Any() ? etIds : null);
    }

    public override async Task<ActionResponse> CreateActivity(ActivityMessage request, ServerCallContext context)
    {
        var id = await _catalogService.CreateActivityAsync(ActivityFromProto(request));
        return new ActionResponse { Success = true, ObjectId = id.ToString() };
    }

    public override async Task<ActionResponse> UpdateActivity(ActivityMessage request, ServerCallContext context)
    {
        await _catalogService.UpdateActivityAsync(ActivityFromProto(request));
        return new ActionResponse { Success = true, Message = "Actividad actualizada." };
    }

    public override async Task<ActionResponse> DeleteActivity(DeleteEntityRequest request, ServerCallContext context)
    {
        await _catalogService.DeleteActivityAsync(Guid.Parse(request.Id));
        return new ActionResponse { Success = true, Message = "Actividad eliminada." };
    }

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
        var tid = string.IsNullOrEmpty(request.TenantId) ? (Guid?)null : Guid.Parse(request.TenantId);
        var id = await _catalogService.CreateCategoryAsync(new AnimalCategoryDto(
            Guid.Empty, request.Name, Guid.Parse(request.ActivityId), decimal.Parse(request.StandardWeightKg), 
            request.CategoryType, request.ExternalId, request.IsActive, tid));
        return new ActionResponse { Success = true, ObjectId = id.ToString() };
    }

    public override async Task<ActionResponse> UpdateAnimalCategory(AnimalCategoryMessage request, ServerCallContext context)
    {
        var tid = string.IsNullOrEmpty(request.TenantId) ? (Guid?)null : Guid.Parse(request.TenantId);
        await _catalogService.UpdateCategoryAsync(new AnimalCategoryDto(
            Guid.Parse(request.Id), request.Name, Guid.Parse(request.ActivityId), decimal.Parse(request.StandardWeightKg), 
            request.CategoryType, request.ExternalId, request.IsActive, tid));
        return new ActionResponse { Success = true, Message = "Categoría actualizada." };
    }

    public override async Task<CategoryMappingList> GetCategoryMappings(GetCatalogRequest request, ServerCallContext context)
    {
        var mappings = await _catalogService.GetMappingsAsync(Guid.Parse(request.TenantId));
        var response = new CategoryMappingList();
        response.Mappings.AddRange(mappings.Select(m => new CategoryMappingMessage { 
            CategoriaClienteId = m.CategoriaClienteId.ToString(),
            CategoriaGestorId = m.CategoriaGestorId,
            CategoriaClienteNombre = m.CategoriaClienteNombre,
            TenantId = m.TenantId.ToString()
        }));
        return response;
    }

    public override async Task<ActionResponse> AddCategoryMapping(CategoryMappingMessage request, ServerCallContext context)
    {
        await _catalogService.AddMappingAsync(new CategoryMappingDto(
            Guid.Parse(request.CategoriaClienteId),
            request.CategoriaGestorId,
            "", "", Guid.Parse(request.TenantId)
        ));
        return new ActionResponse { Success = true };
    }

    public override async Task<ActionResponse> DeleteCategoryMapping(DeleteCategoryMappingRequest request, ServerCallContext context)
    {
        await _catalogService.DeleteMappingAsync(Guid.Parse(request.CategoriaClienteId), Guid.Parse(request.TenantId));
        return new ActionResponse { Success = true };
    }

    public override async Task<EventTypeList> GetEventTypes(GetCatalogRequest request, ServerCallContext context)
    {
        var sw = Stopwatch.StartNew();
        var types = await _catalogService.GetEventTypesAsync(Guid.Parse(request.TenantId));
        var response = new EventTypeList();
        foreach (var e in types)
        {
            var msg = new EventTypeMessage
            {
                Id = e.Id.ToString(), Code = e.Code, Name = e.Name,
                DebitAccountCode = e.DebitAccountCode, CreditAccountCode = e.CreditAccountCode,
                RequiresOriginDestination = e.RequiresOriginDestination,
                RequiresDestinationField = e.RequiresDestinationField,
                IsActive = e.IsActive, TenantId = e.TenantId.ToString()
            };
            if (e.ActivityIds != null) msg.ActivityIds.AddRange(e.ActivityIds.Select(id => id.ToString()));
            response.EventTypes.Add(msg);
        }
        _logger.LogInformation("GetEventTypes | TenantId={TenantId} | Count={Count} | Duration={DurationMs}ms",
            request.TenantId, response.EventTypes.Count, sw.ElapsedMilliseconds);
        return response;
    }

    private static EventTypeDto EventTypeFromProto(EventTypeMessage r)
    {
        var actIds = r.ActivityIds.Select(Guid.Parse).ToList();
        return new EventTypeDto(
            string.IsNullOrEmpty(r.Id) ? Guid.Empty : Guid.Parse(r.Id),
            r.Code, r.Name, r.DebitAccountCode, r.CreditAccountCode,
            r.RequiresOriginDestination, r.RequiresDestinationField, r.IsActive,
            Guid.Parse(r.TenantId),
            actIds.Any() ? actIds : null);
    }

    public override async Task<ActionResponse> CreateEventType(EventTypeMessage request, ServerCallContext context)
    {
        var id = await _catalogService.CreateEventTypeAsync(EventTypeFromProto(request));
        return new ActionResponse { Success = true, ObjectId = id.ToString() };
    }

    public override async Task<ActionResponse> UpdateEventType(EventTypeMessage request, ServerCallContext context)
    {
        await _catalogService.UpdateEventTypeAsync(EventTypeFromProto(request));
        return new ActionResponse { Success = true };
    }

    public override async Task<ActionResponse> DeleteEventType(DeleteEntityRequest request, ServerCallContext context)
    {
        await _catalogService.DeleteEventTypeAsync(Guid.Parse(request.Id));
        return new ActionResponse { Success = true };
    }

    public override async Task<AccountList> GetAccounts(GetCatalogRequest request, ServerCallContext context)
    {
        var accounts = await _catalogService.GetAccountsAsync(Guid.Parse(request.TenantId));
        var response = new AccountList();
        response.Accounts.AddRange(accounts.Select(a => new AccountMessage { 
            Id = a.Id.ToString(), Code = a.Code, Name = a.Name, PlanId = a.PlanId.ToString(), 
            PlanName = a.PlanName, NormalType = a.NormalType, IsActive = a.IsActive, TenantId = a.TenantId.ToString()
        }));
        return response;
    }

    public override async Task<ActionResponse> CreateAccount(AccountMessage request, ServerCallContext context)
    {
        var id = await _catalogService.CreateAccountAsync(new AccountDto(
            Guid.Empty, request.Code, request.Name, Guid.Parse(request.PlanId), request.PlanName, 
            request.NormalType, request.IsActive, Guid.Parse(request.TenantId)
        ));
        return new ActionResponse { Success = true, ObjectId = id.ToString() };
    }

    public override async Task<ActionResponse> UpdateAccount(AccountMessage request, ServerCallContext context)
    {
        await _catalogService.UpdateAccountAsync(new AccountDto(
            Guid.Parse(request.Id), request.Code, request.Name, Guid.Parse(request.PlanId), request.PlanName, 
            request.NormalType, request.IsActive, Guid.Parse(request.TenantId)
        ));
        return new ActionResponse { Success = true };
    }

    public override async Task<ActionResponse> DeleteAccount(DeleteEntityRequest request, ServerCallContext context)
    {
        await _catalogService.DeleteAccountAsync(Guid.Parse(request.Id));
        return new ActionResponse { Success = true };
    }

    public override async Task<PlanCuentaList> GetPlanes(GetCatalogRequest request, ServerCallContext context)
    {
        var planes = await _catalogService.GetPlanesAsync(Guid.Parse(request.TenantId));
        var response = new PlanCuentaList();
        response.Planes.AddRange(planes.Select(p => new PlanCuentaMessage { Id = p.Id.ToString(), Code = p.Code, Name = p.Name, TenantId = p.TenantId.ToString() }));
        return response;
    }

    public override async Task<ActionResponse> CreatePlan(PlanCuentaMessage request, ServerCallContext context)
    {
        var id = await _catalogService.CreatePlanAsync(new PlanCuentaDto(Guid.Empty, request.Code, request.Name, Guid.Parse(request.TenantId)));
        return new ActionResponse { Success = true, ObjectId = id.ToString() };
    }

    public override async Task<ActionResponse> UpdatePlan(PlanCuentaMessage request, ServerCallContext context)
    {
        await _catalogService.UpdatePlanAsync(new PlanCuentaDto(Guid.Parse(request.Id), request.Code, request.Name, Guid.Parse(request.TenantId)));
        return new ActionResponse { Success = true, Message = "Plan actualizado." };
    }

    public override async Task<ActionResponse> DeletePlan(DeleteEntityRequest request, ServerCallContext context)
    {
        await _catalogService.DeletePlanAsync(Guid.Parse(request.Id));
        return new ActionResponse { Success = true, Message = "Plan eliminado." };
    }

    public override async Task<ErpConceptList> GetErpConcepts(GetCatalogRequest request, ServerCallContext context)
    {
        var concepts = await _catalogService.GetErpConceptsAsync(Guid.Parse(request.TenantId));
        var response = new ErpConceptList();
        response.Concepts.AddRange(concepts.Select(c => new ErpConceptMessage
        {
            Id = c.Id.ToString(),
            Description = c.Description,
            Stock = c.Stock,
            UnitA = c.UnitA ?? "",
            UnitB = c.UnitB ?? "",
            Grupo = c.Grupo ?? "",
            Subgrupo = c.Subgrupo ?? "",
            ExternalId = c.ExternalId ?? ""
        }));
        return response;
    }
}
