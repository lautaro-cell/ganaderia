using System.Text.Json;
using GestorGanadero.Server.Application.Interfaces;

namespace GestorGanadero.Server.Infrastructure.ExternalProviders;

public class GestorMaxProvider : IERPProvider
{
    private readonly HttpClient _httpClient;

    public GestorMaxProvider(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<JsonDocument> GetAccountsAsync(Guid tenantId)
    {
        // Mocking ERP response for V1 MVP
        var mockData = new[]
        {
            new { Code = "1.1.01", Name = "Caja Central", Type = "Activo" },
            new { Code = "5.2.03", Name = "Ventas Hacienda", Type = "Ingreso" },
            new { Code = "1.1.05", Name = "Existencia Hacienda", Type = "Activo" },
            new { Code = "4.1.02", Name = "Producción Ganadera", Type = "Resultado" }
        };

        return JsonDocument.Parse(JsonSerializer.Serialize(mockData));
    }

    public async Task<JsonDocument> GetCostCentersAsync(Guid tenantId)
    {
        var mockData = new[]
        {
            new { Code = "LOTE_01", Name = "Lote La Posta", Surface = 150 },
            new { Code = "LOTE_02", Name = "Lote El Trébol", Surface = 200 }
        };

        return JsonDocument.Parse(JsonSerializer.Serialize(mockData));
    }

    public async Task<JsonDocument> GetAnimalCategoriesAsync(Guid tenantId)
    {
        var mockData = new[]
        {
            new { Code = "VAQ_PRE", Name = "Vaquillona Preñada" },
            new { Code = "NOV_1_2", Name = "Novillo 1 a 2 años" },
            new { Code = "TER_M", Name = "Ternero Macho" }
        };

        return JsonDocument.Parse(JsonSerializer.Serialize(mockData));
    }
}
