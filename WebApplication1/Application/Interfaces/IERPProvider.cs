using System.Text.Json;

namespace WebApplication1.Application.Interfaces;

/// <summary>
/// Abstracción para obtener datos desde el ERP (GestorMax u otros).
/// </summary>
public interface IERPProvider
{
    Task<JsonDocument> GetAccountsAsync(Guid tenantId);
    Task<JsonDocument> GetCostCentersAsync(Guid tenantId);
    Task<JsonDocument> GetAnimalCategoriesAsync(Guid tenantId);
}
