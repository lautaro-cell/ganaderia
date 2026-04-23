using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using App.Application.DTOs;
using App.Application.Interfaces;
using App.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace App.Application.Services;

public class CompanyConfigurationService : ICompanyConfigurationService
{
    private readonly IApplicationDbContext _context;
    private readonly IEncryptionService _encryption;
    private readonly IErpSyncService _syncService;
    private readonly ILogger<CompanyConfigurationService> _logger;

    public CompanyConfigurationService(
        IApplicationDbContext context,
        IEncryptionService encryption,
        IErpSyncService syncService,
        ILogger<CompanyConfigurationService> logger)
    {
        _context = context;
        _encryption = encryption;
        _syncService = syncService;
        _logger = logger;
    }

    public async Task SaveAsync(SaveErpConfigurationCommand command, CancellationToken ct = default)
    {
        // Step 1: DataAnnotations validation
        var results = new List<ValidationResult>();
        if (!Validator.TryValidateObject(command, new ValidationContext(command), results, validateAllProperties: true))
            throw new ValidationException(string.Join("; ", results.Select(r => r.ErrorMessage)));

        var config = await _context.GestorMaxConfigs
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == command.TenantId, ct);

        bool hasNewKey = !string.IsNullOrWhiteSpace(command.ApiKey);

        // ApiKey required for initial configuration
        if (config == null && !hasNewKey)
            throw new ValidationException("La API Key es obligatoria para la configuración inicial.");

        if (hasNewKey && command.ApiKey!.Trim().Length < 8)
            throw new ValidationException("La API Key debe tener al menos 8 caracteres.");

        // Step 2: Update Tenant name (razón social)
        var tenant = await _context.Tenants.FindAsync(new object[] { command.TenantId }, ct)
            ?? throw new InvalidOperationException($"Tenant '{command.TenantId}' no encontrado.");

        tenant.Name = command.TenantName.Trim();

        // Step 3: Upsert GestorMaxConfig
        if (config == null)
        {
            var encKey = _encryption.Encrypt(command.ApiKey!.Trim());
            config = new GestorMaxConfig
            {
                TenantId = command.TenantId,
                GestorDatabaseId = command.GestorDatabaseId,
                ApiKeyEncrypted = encKey,
                ApiKeyLast4 = Last4(command.ApiKey!.Trim()),
                BaseUrl = command.BaseUrl.TrimEnd('/'),
                IsEnabled = true
            };
            _context.GestorMaxConfigs.Add(config);
            // Keep Tenant fields in sync for backward compat with ErpSyncService
            tenant.GestorMaxDatabaseId = command.GestorDatabaseId.ToString();
            tenant.GestorMaxApiKeyEncrypted = encKey;
        }
        else
        {
            config.GestorDatabaseId = command.GestorDatabaseId;
            config.BaseUrl = command.BaseUrl.TrimEnd('/');
            config.IsEnabled = true;

            if (hasNewKey)
            {
                var encKey = _encryption.Encrypt(command.ApiKey!.Trim());
                config.ApiKeyEncrypted = encKey;
                config.ApiKeyLast4 = Last4(command.ApiKey!.Trim());
                tenant.GestorMaxApiKeyEncrypted = encKey;
            }

            tenant.GestorMaxDatabaseId = command.GestorDatabaseId.ToString();
        }

        await _context.SaveChangesAsync(ct);

        // Step 4: Initial catalog sync — persist result regardless of outcome
        try
        {
            await _syncService.SyncCatalogAsync(command.TenantId, ct);
            config.LastSyncAt = DateTimeOffset.UtcNow;
            config.LastSyncOk = true;
            config.LastSyncError = null;
            _logger.LogInformation("Post-save sync OK | TenantId={TenantId}", command.TenantId);
        }
        catch (Exception ex)
        {
            config.LastSyncAt = DateTimeOffset.UtcNow;
            config.LastSyncOk = false;
            config.LastSyncError = ex.Message;
            _logger.LogWarning(ex, "Post-save sync failed | TenantId={TenantId}", command.TenantId);
        }

        await _context.SaveChangesAsync(ct);
    }

    private static string Last4(string key)
        => key.Length >= 4 ? key[^4..] : key;
}
