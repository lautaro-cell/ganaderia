using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using GestorGanadero.Server.Application.Interfaces;
using GestorGanadero.Server.Domain.Entities;
using GestorGanadero.Server.Domain.Enums;
using GestorGanadero.Server.Infrastructure.Persistence;

namespace GestorGanadero.Server.Application.Services;

public class SyncCatalogService : ISyncCatalogService
{
    private readonly GestorGanaderoDbContext _context;
    private readonly IERPProvider _erpProvider;

    public SyncCatalogService(GestorGanaderoDbContext context, IERPProvider erpProvider)
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
            existingCatalog.LastSyncedAt = DateTimeOffset.UtcNow;
            _context.ExternalCatalogs.Update(existingCatalog);
        }
        else
        {
            var newCatalog = new ExternalCatalog
            {
                TenantId = tenantId,
                CatalogType = type,
                Data = data,
                LastSyncedAt = DateTimeOffset.UtcNow
            };
            _context.ExternalCatalogs.Add(newCatalog);
        }

        await _context.SaveChangesAsync();
    }
}
