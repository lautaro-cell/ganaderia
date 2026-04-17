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
    private readonly ILogger<CatalogServiceImplementation> _logger;

    public CatalogServiceImplementation(ICatalogService catalogService, ILogger<CatalogServiceImplementation> logger)
    {
        _catalogService = catalogService;
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
        var types = await _catalogService.GetEventTypesAsync(Guid.Parse(request.TenantId));
        var response = new EventTypeList();
        response.EventTypes.AddRange(types.Select(e => new EventTypeMessage {
            Id = e.Id.ToString(), Code = e.Code, Name = e.Name, DebitAccountCode = e.DebitAccountCode, 
            CreditAccountCode = e.CreditAccountCode, RequiresOriginDestination = e.RequiresOriginDestination, 
            RequiresDestinationField = e.RequiresDestinationField, IsActive = e.IsActive, TenantId = e.TenantId.ToString()
        }));
        return response;
    }

    public override async Task<ActionResponse> CreateEventType(EventTypeMessage request, ServerCallContext context)
    {
        var id = await _catalogService.CreateEventTypeAsync(new EventTypeDto(
            Guid.Empty, request.Code, request.Name, request.DebitAccountCode, request.CreditAccountCode, 
            request.RequiresOriginDestination, request.RequiresDestinationField, request.IsActive, Guid.Parse(request.TenantId)
        ));
        return new ActionResponse { Success = true, ObjectId = id.ToString() };
    }

    public override async Task<ActionResponse> UpdateEventType(EventTypeMessage request, ServerCallContext context)
    {
        await _catalogService.UpdateEventTypeAsync(new EventTypeDto(
            Guid.Parse(request.Id), request.Code, request.Name, request.DebitAccountCode, request.CreditAccountCode, 
            request.RequiresOriginDestination, request.RequiresDestinationField, request.IsActive, Guid.Parse(request.TenantId)
        ));
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
}

