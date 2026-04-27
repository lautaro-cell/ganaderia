using System.Diagnostics;
using System.Net.Http.Headers;
using App.Application.DTOs;
using App.Application.Interfaces;
using App.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace App.Infrastructure.Services;

public class ErpConnectivityService : IErpConnectivityService
{
    private readonly IApplicationDbContext _context;
    private readonly IEncryptionService _encryption;
    private readonly HttpClient _httpClient;
    private readonly ILogger<ErpConnectivityService> _logger;

    public ErpConnectivityService(
        IApplicationDbContext context,
        IEncryptionService encryption,
        HttpClient httpClient,
        ILogger<ErpConnectivityService> logger)
    {
        _context = context;
        _encryption = encryption;
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<VerifyConnectionResult> VerifyConnectionAsync(Guid tenantId, CancellationToken ct = default)
    {
        var config = await _context.GestorMaxConfigs
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.IsEnabled, ct);

        if (config == null)
            return Fail("La empresa no tiene integración GestorMax configurada.", DateTimeOffset.UtcNow, 0);

        string apiKey;
        try
        {
            apiKey = _encryption.Decrypt(config.ApiKeyEncrypted);
            if (string.IsNullOrWhiteSpace(apiKey) || apiKey == "ERROR_DECRYPTING")
                return Fail("No se pudo descifrar la API Key. Reconfigure las credenciales.", DateTimeOffset.UtcNow, 0);
        }
        catch
        {
            return Fail("Error al descifrar las credenciales.", DateTimeOffset.UtcNow, 0);
        }

        var checkedAt = DateTimeOffset.UtcNow;
        var sw = Stopwatch.StartNew();

        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct);
        linked.CancelAfter(TimeSpan.FromSeconds(10));

        try
        {
            var url = $"{config.BaseUrl.TrimEnd('/')}/v3/GestorG4/ListConceptos" +
                      $"?databaseId={config.GestorDatabaseId}&soloFisicos=true";

            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.Add("X-Api-Key", apiKey.Trim());
            req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            req.Headers.UserAgent.ParseAdd("Mozilla/5.0");

            var response = await _httpClient.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, linked.Token);
            sw.Stop();

            bool ok = response.IsSuccessStatusCode;
            string msg = ok
                ? $"Conexión exitosa ({(int)response.StatusCode})."
                : $"Respuesta {(int)response.StatusCode}: {response.ReasonPhrase}.";

            await PersistTestAsync(config, ok, ok ? null : msg, checkedAt, ct);
            return new VerifyConnectionResult(ok, msg, sw.ElapsedMilliseconds, checkedAt);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            sw.Stop();
            const string msg = "Timeout: GestorMax no respondió en 10 segundos.";
            await PersistTestAsync(config, false, msg, checkedAt, ct);
            return Fail(msg, checkedAt, sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            sw.Stop();
            var msg = $"Error de conectividad: {ex.Message}";
            _logger.LogWarning(ex, "Connectivity check failed | TenantId={TenantId}", tenantId);
            await PersistTestAsync(config, false, msg, checkedAt, ct);
            return Fail(msg, checkedAt, sw.ElapsedMilliseconds);
        }
    }

    public async Task<ErpIntegrationStatusDto?> GetStatusAsync(Guid tenantId, CancellationToken ct = default)
    {
        var tenant = await _context.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == tenantId, ct);

        if (tenant == null) return null;

        var config = await _context.GestorMaxConfigs
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == tenantId, ct);

        if (config == null)
            return new ErpIntegrationStatusDto(
                IsConfigured: false,
                IsEnabled: false,
                ApiKeyLast4: null,
                BaseUrl: "",
                GestorDatabaseId: 0,
                TenantName: tenant.Name,
                LastTestedAt: null,
                LastTestOk: null,
                LastTestError: null,
                LastSyncAt: null,
                LastSyncOk: null,
                LastSyncError: null,
                StatusSummary: "Sin configurar");

        return new ErpIntegrationStatusDto(
            IsConfigured: true,
            IsEnabled: config.IsEnabled,
            ApiKeyLast4: config.ApiKeyLast4,
            BaseUrl: config.BaseUrl,
            GestorDatabaseId: config.GestorDatabaseId,
            TenantName: tenant.Name,
            LastTestedAt: config.LastTestedAt,
            LastTestOk: config.LastTestOk,
            LastTestError: config.LastTestError,
            LastSyncAt: config.LastSyncAt,
            LastSyncOk: config.LastSyncOk,
            LastSyncError: config.LastSyncError,
            StatusSummary: BuildSummary(config));
    }

    private static string BuildSummary(GestorMaxConfig cfg)
    {
        if (!cfg.IsEnabled) return "Deshabilitado";
        if (cfg.LastTestOk == true && cfg.LastSyncOk == true) return "Operativo";
        if (cfg.LastTestOk == false) return "Error de conexión";
        if (cfg.LastSyncOk == false) return "Error de sincronización";
        return "Configurado";
    }

    private async Task PersistTestAsync(
        GestorMaxConfig config, bool ok, string? error,
        DateTimeOffset testedAt, CancellationToken ct)
    {
        config.LastTestedAt = testedAt;
        config.LastTestOk = ok;
        config.LastTestError = error;
        try { await _context.SaveChangesAsync(ct); }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not persist connectivity test result.");
        }
    }

    private static VerifyConnectionResult Fail(string msg, DateTimeOffset at, long ms)
        => new(false, msg, ms, at);
}
