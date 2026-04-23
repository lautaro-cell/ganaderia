using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using App.Application.DTOs;
using App.Application.Interfaces;

namespace App.Application.Services;

public class ErpAccountQueryService : IErpAccountQueryService
{
    private readonly IApplicationDbContext _context;
    private readonly IERPProvider _erpProvider;
    private readonly ILogger<ErpAccountQueryService> _logger;

    public ErpAccountQueryService(
        IApplicationDbContext context,
        IERPProvider erpProvider,
        ILogger<ErpAccountQueryService> logger)
    {
        _context = context;
        _erpProvider = erpProvider;
        _logger = logger;
    }

    public async Task<IEnumerable<ErpAccountDto>> GetAccountsForSelectorAsync(Guid tenantId)
    {
        // Valida que el tenant tenga integración configurada antes de llamar al ERP
        var hasConfig = await _context.GestorMaxConfigs
            .AnyAsync(c => c.TenantId == tenantId && c.IsEnabled);

        if (!hasConfig)
            throw new InvalidOperationException(
                $"El tenant '{tenantId}' no tiene integración GestorMax configurada o activa.");

        using var scope = _logger.BeginScope(new Dictionary<string, object>
        {
            ["TenantId"] = tenantId,
            ["Operation"] = "GetErpAccountsForSelector"
        });

        try
        {
            var json = await _erpProvider.GetAccountsAsync(tenantId);
            var accounts = ParseAccounts(json);

            _logger.LogInformation(
                "ERP accounts loaded | Count={Count}", accounts.Count);

            return accounts;
        }
        catch (Exception ex) when (ex is not InvalidOperationException)
        {
            _logger.LogError(ex, "Error al obtener cuentas del ERP | Detail={Detail}", ex.Message);
            throw new InvalidOperationException(
                "No se pudo conectar con GestorMax para obtener el plan de cuentas.", ex);
        }
    }

    private static List<ErpAccountDto> ParseAccounts(JsonDocument json)
    {
        var accounts = new List<ErpAccountDto>();

        foreach (var element in json.RootElement.EnumerateArray())
        {
            var code = element.TryGetProperty("Code", out var c) ? c.GetString() ?? "" : "";
            var name = element.TryGetProperty("Name", out var n) ? n.GetString() ?? "" : "";
            var type = element.TryGetProperty("Type", out var t) ? t.GetString() ?? "" : "";

            if (!string.IsNullOrWhiteSpace(code))
                accounts.Add(new ErpAccountDto(code, name, type));
        }

        return accounts;
    }
}
