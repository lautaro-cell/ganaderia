using System.Text.Json;

namespace WebApplication1.Application.Interfaces;

public interface ISyncCatalogService
{
    /// <summary>
    /// SyncCatalogsAsync(TenantId, CatalogData)
    /// </summary>
    Task SyncCatalogsAsync(Guid tenantId, JsonDocument catalogData);
}
