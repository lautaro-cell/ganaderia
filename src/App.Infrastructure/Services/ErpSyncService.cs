using App.Application.Interfaces;
using App.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace App.Infrastructure.Services;

public class ErpSyncService : IErpSyncService
{
    private readonly IApplicationDbContext _context;
    private readonly ILogger<ErpSyncService> _logger;
    private readonly IEncryptionService _encryptionService;
    private readonly ITenantProvider _tenantProvider;
    private readonly HttpClient _httpClient;
    private const string BaseUrl = "https://api.gestormax.com";

    public ErpSyncService(
        IApplicationDbContext context,
        ILogger<ErpSyncService> logger,
        IEncryptionService encryptionService,
        ITenantProvider tenantProvider,
        HttpClient httpClient)
    {
        _context = context;
        _logger = logger;
        _encryptionService = encryptionService;
        _tenantProvider = tenantProvider;
        _httpClient = httpClient;
    }

    public async Task SyncCatalogAsync(Guid? overrideTenantId = null, CancellationToken ct = default)
    {
        var tenantId = overrideTenantId ?? _tenantProvider.TenantId;
        if (tenantId == Guid.Empty) return;

        var tenant = await _context.Tenants.FindAsync(new object[] { tenantId }, ct);
        if (tenant == null || string.IsNullOrEmpty(tenant.GestorMaxApiKeyEncrypted)) return;

        try
        {
            string apiKey = _encryptionService.Decrypt(tenant.GestorMaxApiKeyEncrypted);
            if (apiKey == "ERROR_DECRYPTING" || string.IsNullOrWhiteSpace(tenant.GestorMaxDatabaseId)) return;

            var url = $"{BaseUrl}/v3/GestorG4/ListConceptos?databaseId={tenant.GestorMaxDatabaseId.Trim()}&soloFisicos=true";
            
            // Clean headers before adding new ones (as this client is injected and might be reused)
            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Add("X-Api-Key", apiKey.Trim());
            _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0");

            var response = await _httpClient.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch concepts from GestorMax. Status: {Status}", response.StatusCode);
                return;
            }

            var options = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var erpStock = await response.Content.ReadFromJsonAsync<List<ErpConceptResponse>>(options, ct);
            if (erpStock == null) return;

            foreach (var item in erpStock)
            {
                if (string.IsNullOrEmpty(item.Descripcion)) continue;

                var externalId = item.CodConcepto?.ToString() ?? item.Descripcion;
                var grupo = (item.GrupoConceptos ?? item.GrupoConcepto ?? "").ToUpper().Trim();
                var subGrupo = (item.SubgrupoConceptos ?? item.SubgrupoConcepto ?? "").ToUpper().Trim();

                // Filtrar solo HACIENDA como solicita el usuario
                if (grupo != "HACIENDA") continue;

                var concept = await _context.ErpConcepts
                    .IgnoreQueryFilters()
                    .Where(c => c.TenantId == tenantId && c.ExternalErpId == externalId)
                    .FirstOrDefaultAsync(ct);

                if (concept == null)
                {
                    concept = new ErpConcept
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        ExternalErpId = externalId,
                        Description = item.Descripcion,
                        Stock = item.Cantidad,
                        UnitA = item.UnidadA,
                        UnitB = item.UnidadB,
                        GrupoConcepto = grupo,
                        SubGrupoConcepto = subGrupo,
                        LastSyncDate = DateTime.UtcNow
                    };
                    _context.ErpConcepts.Add(concept);
                }
                else
                {
                    concept.Description = item.Descripcion;
                    concept.Stock = item.Cantidad;
                    concept.UnitA = item.UnidadA;
                    concept.UnitB = item.UnidadB;
                    concept.GrupoConcepto = grupo;
                    concept.SubGrupoConcepto = subGrupo;
                    concept.LastSyncDate = DateTime.UtcNow;
                }
            }
            await _context.SaveChangesAsync(ct);
            _logger.LogInformation("Successfully synced HACIENDA concepts for tenant {TenantId}", tenantId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing Catalog for tenant {TenantId}.", tenantId);
        }
    }

    private record ErpConceptResponse(
        [property: JsonPropertyName("codConcepto")] object? CodConcepto,
        [property: JsonPropertyName("descripcion")] string Descripcion, 
        [property: JsonPropertyName("cantidad")] double Cantidad, 
        [property: JsonPropertyName("unidadAuxiliar")] string? UnidadA,
        [property: JsonPropertyName("UnidadPrecio")] string? UnidadB,
        [property: JsonPropertyName("grupoConceptos")] string? GrupoConceptos,
        [property: JsonPropertyName("subgrupoConceptos")] string? SubgrupoConceptos,
        [property: JsonPropertyName("grupoConcepto")] string? GrupoConcepto,
        [property: JsonPropertyName("subgrupoConcepto")] string? SubgrupoConcepto);
}
