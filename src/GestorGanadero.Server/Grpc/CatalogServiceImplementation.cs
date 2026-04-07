using Grpc.Core;
using App.Application.Interfaces;
using App.Application.DTOs;
using GestorGanadero.Services.Catalog.Contracts;
using GestorGanadero.Services.Common.Contracts;
using Microsoft.Extensions.Logging;
using System.Linq;
using System.Threading.Tasks;
using System;

namespace GestorGanadero.Server.Grpc;

public class CatalogServiceImplementation : CatalogService.CatalogServiceBase
{
    private readonly ICatalogService _catalogService;
    private readonly ILoteService _loteService;
    private readonly ILogger<CatalogServiceImplementation> _logger;

    public CatalogServiceImplementation(ICatalogService catalogService, ILoteService loteService, ILogger<CatalogServiceImplementation> logger)
    {
        _catalogService = catalogService;
        _loteService = loteService;
        _logger = logger;
    }

    public override async Task<FieldList> GetFields(GetCatalogRequest request, ServerCallContext context)
    {
        var fields = await _catalogService.GetFieldsAsync();
        var response = new FieldList();
        response.Fields.AddRange(fields.Select(f => new FieldMessage { Id = f.Id.ToString(), Name = f.Name, Description = f.Description ?? "", IsActive = f.IsActive, TenantId = f.TenantId.ToString() }));
        return response;
    }

    public override async Task<ActionResponse> CreateField(FieldMessage request, ServerCallContext context)
    {
        var id = await _catalogService.CreateFieldAsync(new FieldDto(Guid.Empty, request.Name, request.Description, request.IsActive, Guid.TryParse(request.TenantId, out var ftid) ? ftid : Guid.Empty));
        return new ActionResponse { Success = true, ObjectId = id.ToString() };
    }

    public override async Task<ActionResponse> UpdateField(FieldMessage request, ServerCallContext context)
    {
        await _catalogService.UpdateFieldAsync(new FieldDto(Guid.Parse(request.Id), request.Name, request.Description, request.IsActive, Guid.TryParse(request.TenantId, out var utid) ? utid : Guid.Empty));
        return new ActionResponse { Success = true, Message = "Campo actualizado." };
    }

    public override async Task<ActionResponse> DeleteField(DeleteEntityRequest request, ServerCallContext context)
    {
        await _catalogService.DeleteFieldAsync(Guid.Parse(request.Id));
        return new ActionResponse { Success = true, Message = "Campo eliminado." };
    }

    public override async Task<ActivityList> GetActivities(GetCatalogRequest request, ServerCallContext context)
    {
        var activities = await _catalogService.GetActivitiesAsync();
        var response = new ActivityList();
        response.Activities.AddRange(activities.Select(a => new ActivityMessage { Id = a.Id.ToString(), Name = a.Name, IsGlobal = a.IsGlobal, TenantId = a.TenantId?.ToString() ?? "" }));
        return response;
    }

    public override async Task<ActionResponse> CreateActivity(ActivityMessage request, ServerCallContext context)
    {
        var tid = string.IsNullOrEmpty(request.TenantId) ? (Guid?)null : Guid.Parse(request.TenantId);
        var id = await _catalogService.CreateActivityAsync(new ActivityDto(Guid.Empty, request.Name, request.IsGlobal, tid));
        return new ActionResponse { Success = true, ObjectId = id.ToString() };
    }

    public override async Task<ActionResponse> UpdateActivity(ActivityMessage request, ServerCallContext context)
    {
        var tid = string.IsNullOrEmpty(request.TenantId) ? (Guid?)null : Guid.Parse(request.TenantId);
        await _catalogService.UpdateActivityAsync(new ActivityDto(Guid.Parse(request.Id), request.Name, request.IsGlobal, tid));
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

    public override async Task<ActionResponse> DeleteAnimalCategory(DeleteEntityRequest request, ServerCallContext context)
    {
        await _catalogService.DeleteCategoryAsync(Guid.Parse(request.Id));
        return new ActionResponse { Success = true, Message = "Categoría eliminada." };
    }

    public override async Task<LoteList> GetLotes(GetLotesRequest request, ServerCallContext context)
    {
        if (string.IsNullOrEmpty(request.FieldId) || !Guid.TryParse(request.FieldId, out var fieldId))
        {
            return new LoteList();
        }
        var lotes = await _loteService.GetLotesByFieldAsync(fieldId);
        var response = new LoteList();
        response.Lotes.AddRange(lotes.Select(l => new LoteMessage { Id = l.Id.ToString(), Name = l.Name, FieldId = l.FieldId.ToString(), FieldName = l.FieldName ?? "", ActivityIds = { l.ActivityIds.Select(id => id.ToString()) } }));
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
}

