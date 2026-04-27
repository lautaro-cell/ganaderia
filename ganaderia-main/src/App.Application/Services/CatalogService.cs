using NodaTime;
using Microsoft.EntityFrameworkCore;
using App.Application.DTOs;
using App.Application.Interfaces;
using App.Domain.Entities;


namespace App.Application.Services;

public class CatalogService : ICatalogService
{
    private readonly IApplicationDbContext _context;
    private readonly ITenantProvider _tenantProvider;

    public CatalogService(IApplicationDbContext context, ITenantProvider tenantProvider)
    {
        _context = context;
        _tenantProvider = tenantProvider;
    }

    // --- Fields ---
    public async Task<IEnumerable<FieldDto>> GetFieldsAsync()
    {
        return await _context.Fields
            .AsNoTracking()
            .Include(f => f.FieldActivities)
            .Select(f => new FieldDto(
                f.Id, f.Name, f.Description, f.IsActive, f.TenantId,
                f.LegalName, f.AreaHectares, f.GpsLatitude, f.GpsLongitude,
                f.FieldActivities.Select(fa => fa.ActivityId).ToList()))
            .ToListAsync();
    }

    public async Task<Guid> CreateFieldAsync(FieldDto dto)
    {
        var field = new Field
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            Description = dto.Description,
            LegalName = dto.LegalName,
            AreaHectares = dto.AreaHectares,
            GpsLatitude = dto.GpsLatitude,
            GpsLongitude = dto.GpsLongitude,
            TenantId = _tenantProvider.TenantId,
            IsActive = true
        };
        _context.Fields.Add(field);

        if (dto.ActivityIds != null)
            foreach (var aid in dto.ActivityIds)
                _context.FieldActivities.Add(new FieldActivity { FieldId = field.Id, ActivityId = aid });

        await _context.SaveChangesAsync();
        return field.Id;
    }

    public async Task UpdateFieldAsync(FieldDto dto)
    {
        var field = await _context.Fields.FindAsync(dto.Id);
        if (field == null) throw new KeyNotFoundException("Campo no encontrado");

        field.Name = dto.Name;
        field.Description = dto.Description;
        field.LegalName = dto.LegalName;
        field.AreaHectares = dto.AreaHectares;
        field.GpsLatitude = dto.GpsLatitude;
        field.GpsLongitude = dto.GpsLongitude;
        field.IsActive = dto.IsActive;

        if (dto.ActivityIds != null)
        {
            var existing = await _context.FieldActivities.Where(fa => fa.FieldId == dto.Id).ToListAsync();
            foreach (var fa in existing) _context.FieldActivities.Remove(fa);
            foreach (var aid in dto.ActivityIds)
                _context.FieldActivities.Add(new FieldActivity { FieldId = dto.Id, ActivityId = aid });
        }

        await _context.SaveChangesAsync();
    }

    public async Task DeleteFieldAsync(Guid id)
    {
        var field = await _context.Fields.FindAsync(id);
        if (field != null)
        {
            _context.Fields.Remove(field);
            await _context.SaveChangesAsync();
        }
    }

    // --- Activities ---
    public async Task<IEnumerable<ActivityDto>> GetActivitiesAsync()
    {
        return await _context.Activities
            .AsNoTracking()
            .Include(a => a.ActivityAnimalCategories)
            .Select(a => new ActivityDto(
                a.Id, a.Name, a.TenantId == null, a.TenantId, a.Description,
                a.ActivityAnimalCategories.Select(ac => ac.AnimalCategoryId).ToList(),
                null))
            .ToListAsync();
    }

    public async Task<Guid> CreateActivityAsync(ActivityDto dto)
    {
        var activity = new Activity
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            Description = dto.Description,
            TenantId = dto.IsGlobal ? null : _tenantProvider.TenantId
        };
        _context.Activities.Add(activity);

        if (dto.CategoryIds != null)
            foreach (var cid in dto.CategoryIds)
                _context.ActivityAnimalCategories.Add(new ActivityAnimalCategory { ActivityId = activity.Id, AnimalCategoryId = cid });

        if (dto.EventTypeIds != null)
            foreach (var etId in dto.EventTypeIds)
                _context.EventTemplateActivities.Add(new EventTemplateActivity { EventTemplateId = etId, ActivityId = activity.Id });

        await _context.SaveChangesAsync();
        return activity.Id;
    }

    public async Task UpdateActivityAsync(ActivityDto dto)
    {
        var activity = await _context.Activities.FindAsync(dto.Id);
        if (activity == null) throw new KeyNotFoundException("Actividad no encontrada");
        activity.Name = dto.Name;
        activity.Description = dto.Description;

        if (dto.CategoryIds != null)
        {
            var existing = await _context.ActivityAnimalCategories.Where(ac => ac.ActivityId == dto.Id).ToListAsync();
            foreach (var ac in existing) _context.ActivityAnimalCategories.Remove(ac);
            foreach (var cid in dto.CategoryIds)
                _context.ActivityAnimalCategories.Add(new ActivityAnimalCategory { ActivityId = dto.Id, AnimalCategoryId = cid });
        }

        if (dto.EventTypeIds != null)
        {
            var existing = await _context.EventTemplateActivities.Where(eta => eta.ActivityId == dto.Id).ToListAsync();
            foreach (var eta in existing) _context.EventTemplateActivities.Remove(eta);
            foreach (var etId in dto.EventTypeIds)
                _context.EventTemplateActivities.Add(new EventTemplateActivity { EventTemplateId = etId, ActivityId = dto.Id });
        }

        await _context.SaveChangesAsync();
    }

    public async Task DeleteActivityAsync(Guid id)
    {
        var activity = await _context.Activities.FindAsync(id);
        if (activity != null)
        {
            _context.Activities.Remove(activity);
            await _context.SaveChangesAsync();
        }
    }

    // --- Categories ---
    public async Task<IEnumerable<AnimalCategoryDto>> GetCategoriesAsync()
    {
        return await _context.AnimalCategories
            .AsNoTracking()
            .Select(c => new AnimalCategoryDto(
                c.Id, c.Name, c.ActivityId, c.StandardWeightKg ?? 0, 
                "CLIENTE", c.ExternalId, c.IsActive, c.TenantId))
            .ToListAsync();
    }

    public async Task<Guid> CreateCategoryAsync(AnimalCategoryDto dto)
    {
        var category = new AnimalCategory
        {
            Name = dto.Name,
            ActivityId = dto.ActivityId,
            StandardWeightKg = dto.StandardWeightKg,
            TenantId = _tenantProvider.TenantId,
            IsActive = true
        };
        _context.AnimalCategories.Add(category);
        await _context.SaveChangesAsync();
        return category.Id;
    }

    public async Task UpdateCategoryAsync(AnimalCategoryDto dto)
    {
        var category = await _context.AnimalCategories.FindAsync(dto.Id);
        if (category == null) throw new KeyNotFoundException("Categoría no encontrada");
        
        category.Name = dto.Name;
        category.StandardWeightKg = dto.StandardWeightKg;
        category.IsActive = dto.IsActive;
        
        await _context.SaveChangesAsync();
    }

    public async Task DeleteCategoryAsync(Guid id)
    {
        var category = await _context.AnimalCategories.FindAsync(id);
        if (category != null)
        {
            _context.AnimalCategories.Remove(category);
            await _context.SaveChangesAsync();
        }
    }

    // --- Mappings ---
    public async Task<IEnumerable<CategoryMappingDto>> GetMappingsAsync(Guid tenantId)
    {
        return await _context.CategoryMappings
            .AsNoTracking()
            .Include(m => m.CategoriaCliente)
            .Where(m => m.TenantId == tenantId)
            .Select(m => new CategoryMappingDto(m.CategoriaClienteId, m.CategoriaGestorId, m.CategoriaCliente != null ? m.CategoriaCliente.Name : "Desconocido", "", tenantId))
            .ToListAsync();
    }

    public async Task AddMappingAsync(CategoryMappingDto dto)
    {
        var mapping = new CategoryMapping
        {
            TenantId = dto.TenantId,
            CategoriaClienteId = dto.CategoriaClienteId,
            CategoriaGestorId = dto.CategoriaGestorId
        };
        _context.CategoryMappings.Add(mapping);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteMappingAsync(Guid categoriaClienteId, Guid tenantId)
    {
        var mapping = await _context.CategoryMappings
            .FirstOrDefaultAsync(m => m.CategoriaClienteId == categoriaClienteId && m.TenantId == tenantId);
        if (mapping != null)
        {
            _context.CategoryMappings.Remove(mapping);
            await _context.SaveChangesAsync();
        }
    }

    // --- Event Types ---
    public async Task<IEnumerable<EventTypeDto>> GetEventTypesAsync(Guid tenantId)
    {
        return await _context.EventTemplates
            .AsNoTracking()
            .Where(e => e.TenantId == tenantId)
            .Include(e => e.EventTemplateActivities)
            .Select(e => new EventTypeDto(
                e.Id, e.Code, e.Name, e.DebitAccountCode, e.CreditAccountCode,
                e.RequiresOriginDestination, e.RequiresDestinationField, e.IsActive, tenantId,
                e.EventTemplateActivities.Select(eta => eta.ActivityId).ToList()))
            .ToListAsync();
    }

    public async Task<Guid> CreateEventTypeAsync(EventTypeDto dto)
    {
        var et = new EventTemplate
        {
            Code = dto.Code,
            Name = dto.Name,
            DebitAccountCode = dto.DebitAccountCode,
            CreditAccountCode = dto.CreditAccountCode,
            RequiresOriginDestination = dto.RequiresOriginDestination,
            RequiresDestinationField = dto.RequiresDestinationField,
            TenantId = dto.TenantId,
            IsActive = true
        };
        _context.EventTemplates.Add(et);
        await _context.SaveChangesAsync();
        return et.Id;
    }

    public async Task UpdateEventTypeAsync(EventTypeDto dto)
    {
        var et = await _context.EventTemplates.FindAsync(dto.Id);
        if (et == null) throw new KeyNotFoundException("Tipo de evento no encontrado");
        et.Name = dto.Name;
        et.Code = dto.Code;
        et.DebitAccountCode = dto.DebitAccountCode;
        et.CreditAccountCode = dto.CreditAccountCode;
        et.RequiresOriginDestination = dto.RequiresOriginDestination;
        et.RequiresDestinationField = dto.RequiresDestinationField;
        et.IsActive = dto.IsActive;

        if (dto.ActivityIds != null)
        {
            var existing = await _context.EventTemplateActivities.Where(eta => eta.EventTemplateId == dto.Id).ToListAsync();
            foreach (var eta in existing) _context.EventTemplateActivities.Remove(eta);
            foreach (var aid in dto.ActivityIds)
                _context.EventTemplateActivities.Add(new EventTemplateActivity { EventTemplateId = dto.Id, ActivityId = aid });
        }

        await _context.SaveChangesAsync();
    }

    public async Task DeleteEventTypeAsync(Guid id)
    {
        var et = await _context.EventTemplates.FindAsync(id);
        if (et != null)
        {
            _context.EventTemplates.Remove(et);
            await _context.SaveChangesAsync();
        }
    }

    // --- Accounts ---
    public async Task<IEnumerable<AccountDto>> GetAccountsAsync(Guid tenantId)
    {
        return await _context.Accounts
            .AsNoTracking()
            .Include(a => a.Plan)
            .Where(a => a.TenantId == tenantId)
            .Select(a => new AccountDto(a.Id, a.Code, a.Name, a.PlanId, a.Plan!.Name, a.NormalType.ToString(), a.IsActive, tenantId))
            .ToListAsync();
    }

    public async Task<Guid> CreateAccountAsync(AccountDto dto)
    {
        var account = new Account
        {
            Code = dto.Code,
            Name = dto.Name,
            PlanId = dto.PlanId,
            NormalType = Enum.Parse<NormalType>(dto.NormalType),
            TenantId = dto.TenantId,
            IsActive = true
        };
        _context.Accounts.Add(account);
        await _context.SaveChangesAsync();
        return account.Id;
    }

    public async Task UpdateAccountAsync(AccountDto dto)
    {
        var account = await _context.Accounts.FindAsync(dto.Id);
        if (account == null) throw new KeyNotFoundException("Cuenta no encontrada");
        account.Code = dto.Code;
        account.Name = dto.Name;
        account.PlanId = dto.PlanId;
        account.NormalType = Enum.Parse<NormalType>(dto.NormalType);
        account.IsActive = dto.IsActive;
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAccountAsync(Guid id)
    {
        var account = await _context.Accounts.FindAsync(id);
        if (account != null)
        {
            _context.Accounts.Remove(account);
            await _context.SaveChangesAsync();
        }
    }

    // --- Erp Concepts ---
    public async Task<IEnumerable<ErpConceptDto>> GetErpConceptsAsync(Guid tenantId)
    {
        return await _context.ErpConcepts
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId)
            .Select(c => new ErpConceptDto(
                c.Id, 
                c.Description, 
                c.Stock, 
                c.UnitA, 
                c.UnitB, 
                c.GrupoConcepto, 
                c.SubGrupoConcepto, 
                c.ExternalErpId, 
                c.TenantId))
            .ToListAsync();
    }
}

