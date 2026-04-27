namespace App.Application.Interfaces;

public interface IErpSyncService
{
    Task SyncCatalogAsync(Guid? overrideTenantId = null, CancellationToken ct = default);
}
