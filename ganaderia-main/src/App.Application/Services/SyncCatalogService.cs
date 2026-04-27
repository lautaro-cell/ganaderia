using NodaTime;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using App.Application.Interfaces;
using App.Domain.Entities;
using App.Domain.Enums;


namespace App.Application.Services;

public class SyncCatalogService : ISyncCatalogService
{
    private readonly IApplicationDbContext _context;
    private readonly IERPProvider _erpProvider;

    public SyncCatalogService(IApplicationDbContext context, IERPProvider erpProvider)
    {
        _context = context;
        _erpProvider = erpProvider;
    }

    public async Task SyncAllCatalogsAsync(Guid tenantId)
    {
        await SyncCatalogByType(tenantId, CatalogType.PlanCuentas, () => _erpProvider.GetAccountsAsync(tenantId));
        await SyncCatalogByType(tenantId, CatalogType.CentrosCosto, () => _erpProvider.GetCostCentersAsync(tenantId));
        await SyncCatalogByType(tenantId, CatalogType.CategoriasAnimales, () => _erpProvider.GetAnimalCategoriesAsync(tenantId));
    }

    private async Task SyncCatalogByType(Guid tenantId, CatalogType type, Func<Task<JsonDocument>> fetchFunc)
    {
        var data = await fetchFunc();

        var existingCatalog = await _context.ExternalCatalogs
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.CatalogType == type);

        if (existingCatalog != null)
        {
            existingCatalog.Data = data;
            existingCatalog.LastSyncedAt = SystemClock.Instance.GetCurrentInstant();
            _context.ExternalCatalogs.Update(existingCatalog);
        }
        else
        {
            var newCatalog = new ExternalCatalog
            {
                TenantId = tenantId,
                CatalogType = type,
                Data = data,
                LastSyncedAt = SystemClock.Instance.GetCurrentInstant()
            };
            _context.ExternalCatalogs.Add(newCatalog);
        }

        await _context.SaveChangesAsync();

        if (type == CatalogType.CategoriasAnimales)
        {
            await ProcessAnimalCategories(tenantId, data);
        }
    }

    private async Task ProcessAnimalCategories(Guid tenantId, JsonDocument data)
    {
        var rawCategories = data.RootElement.EnumerateArray()
            .Select(catJson => new
            {
                Code = catJson.GetProperty("Code").GetString() ?? "",
                Name = catJson.GetProperty("Name").GetString() ?? ""
            })
            .Where(x => !string.IsNullOrWhiteSpace(x.Code))
            .ToList();

        var codes = rawCategories.Select(x => x.Code).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var existing = await _context.AnimalCategories
            .IgnoreQueryFilters()
            .Where(c => c.TenantId == tenantId
                        && c.Type == CategoryType.Gestor
                        && c.ExternalId != null
                        && codes.Contains(c.ExternalId))
            .ToListAsync();

        var existingByCode = existing
            .Where(e => !string.IsNullOrWhiteSpace(e.ExternalId))
            .ToDictionary(e => e.ExternalId!, StringComparer.OrdinalIgnoreCase);

        foreach (var cat in rawCategories)
        {
            if (!existingByCode.TryGetValue(cat.Code, out var category))
            {
                _context.AnimalCategories.Add(new AnimalCategory
                {
                    TenantId = tenantId,
                    ExternalId = cat.Code,
                    Name = cat.Name,
                    Type = CategoryType.Gestor,
                    IsActive = true,
                    LastSyncedAt = SystemClock.Instance.GetCurrentInstant()
                });
            }
            else
            {
                category.Name = cat.Name;
                category.LastSyncedAt = SystemClock.Instance.GetCurrentInstant();
            }
        }

        await _context.SaveChangesAsync();
    }
}
