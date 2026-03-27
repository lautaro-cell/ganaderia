using System.Text.Json;

namespace GestorGanadero.Server.Application.Interfaces;

public interface ISyncCatalogService
{
    /// <summary>
    /// Sincroniza todos los catálogos (cuentas, centros de costo, categorías) del tenant desde el ERP.
    /// </summary>
    Task SyncAllCatalogsAsync(Guid tenantId);
}
