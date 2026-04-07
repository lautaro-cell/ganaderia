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
            .Select(f => new FieldDto(f.Id, f.Name, f.Description, f.IsActive, f.TenantId))
            .ToListAsync();
    }

    public async Task<Guid> CreateFieldAsync(FieldDto dto)
    {
        var field = new Field
        {
            Name = dto.Name,
            Description = dto.Description,
            TenantId = _tenantProvider.TenantId,
            IsActive = true
        };
        _context.Fields.Add(field);
        await _context.SaveChangesAsync();
        return field.Id;
    }

    public async Task UpdateFieldAsync(FieldDto dto)
    {
        var field = await _context.Fields.FindAsync(dto.Id);
        if (field == null) throw new KeyNotFoundException("Campo no encontrado");
        
        field.Name = dto.Name;
        field.Description = dto.Description;
        field.IsActive = dto.IsActive;
        
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
            .Select(a => new ActivityDto(a.Id, a.Name, a.TenantId == null, a.TenantId))
            .ToListAsync();
    }

    public async Task<Guid> CreateActivityAsync(ActivityDto dto)
    {
        var activity = new Activity
        {
            Name = dto.Name,
            TenantId = dto.IsGlobal ? null : _tenantProvider.TenantId
        };
        _context.Activities.Add(activity);
        await _context.SaveChangesAsync();
        return activity.Id;
    }

    public async Task UpdateActivityAsync(ActivityDto dto)
    {
        var activity = await _context.Activities.FindAsync(dto.Id);
        if (activity == null) throw new KeyNotFoundException("Actividad no encontrada");
        activity.Name = dto.Name;
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
}


