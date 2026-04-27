using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using App.Application.DTOs;
using App.Application.Interfaces;
using App.Domain.Entities;
using App.Domain.Enums;
using App.Domain.Exceptions;

namespace App.Application.Services;

public class AccountConfigurationService : IAccountConfigurationService
{
    private readonly IApplicationDbContext _context;

    public AccountConfigurationService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<string> GetDebitAccountCodeAsync(Guid tenantId, EventType eventType, string? defaultAccountCode = null)
    {
        var config = await GetConfigurationAsync(tenantId, eventType);
        
        if (config != null)
            return config.DebitAccountCode;
            
        if (!string.IsNullOrWhiteSpace(defaultAccountCode))
            return defaultAccountCode;
            
        throw AccountConfigurationException.MissingDebitAccount(tenantId, eventType);
    }
    
    public async Task<string> GetCreditAccountCodeAsync(Guid tenantId, EventType eventType, string? defaultAccountCode = null)
    {
        var config = await GetConfigurationAsync(tenantId, eventType);
        
        if (config != null)
            return config.CreditAccountCode;
            
        if (!string.IsNullOrWhiteSpace(defaultAccountCode))
            return defaultAccountCode;
            
        throw AccountConfigurationException.MissingCreditAccount(tenantId, eventType);
    }
    
    public async Task<(string DebitAccountCode, string CreditAccountCode)> GetAccountCodesAsync(
        Guid tenantId, 
        EventType eventType, 
        string? defaultDebitAccountCode = null, 
        string? defaultCreditAccountCode = null)
    {
        var config = await GetConfigurationAsync(tenantId, eventType);
        
        if (config != null)
            return (config.DebitAccountCode, config.CreditAccountCode);
            
        if (!string.IsNullOrWhiteSpace(defaultDebitAccountCode) && !string.IsNullOrWhiteSpace(defaultCreditAccountCode))
            return (defaultDebitAccountCode, defaultCreditAccountCode);
            
        if (string.IsNullOrWhiteSpace(defaultDebitAccountCode))
            throw AccountConfigurationException.MissingDebitAccount(tenantId, eventType);
            
        throw AccountConfigurationException.MissingCreditAccount(tenantId, eventType);
    }
    
    // context7 /dotnet/docs: two-step validation — DataAnnotations en command + domain guard en servicio
    public async Task<Guid> SaveAsync(SaveAccountConfigurationCommand command)
    {
        // Paso 1: DataAnnotations
        var validationResults = new List<ValidationResult>();
        if (!Validator.TryValidateObject(command, new ValidationContext(command), validationResults, validateAllProperties: true))
        {
            var errors = string.Join("; ", validationResults.Select(r => r.ErrorMessage));
            throw new ValidationException(errors);
        }

        // Paso 2: reglas de dominio
        if (string.Equals(command.DebitAccountCode.Trim(), command.CreditAccountCode.Trim(), StringComparison.OrdinalIgnoreCase))
            throw new ValidationException("La cuenta DEBE y la cuenta HABER no pueden ser iguales.");

        if (!Enum.IsDefined(typeof(EventType), command.EventType))
            throw new ValidationException($"El tipo de evento '{command.EventType}' no es válido.");

        // Upsert: actualiza si ya existe, crea si no
        var existing = await _context.AccountConfigurations
            .FirstOrDefaultAsync(ac => ac.TenantId == command.TenantId && ac.EventType == command.EventType);

        if (existing != null)
        {
            existing.DebitAccountCode  = command.DebitAccountCode.Trim();
            existing.CreditAccountCode = command.CreditAccountCode.Trim();
            existing.Description       = command.Description;
            existing.IsActive          = true;
            await _context.SaveChangesAsync();
            return existing.Id;
        }

        var config = new AccountConfiguration
        {
            TenantId           = command.TenantId,
            EventType          = command.EventType,
            DebitAccountCode   = command.DebitAccountCode.Trim(),
            CreditAccountCode  = command.CreditAccountCode.Trim(),
            Description        = command.Description,
            IsActive           = true
        };
        _context.AccountConfigurations.Add(config);
        await _context.SaveChangesAsync();
        return config.Id;
    }

    private async Task<AccountConfiguration?> GetConfigurationAsync(Guid tenantId, EventType eventType)
    {
        return await _context.AccountConfigurations
            .Where(ac => ac.TenantId == tenantId && ac.EventType == eventType && ac.IsActive)
            .FirstOrDefaultAsync();
    }
}