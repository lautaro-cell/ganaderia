using App.Application.DTOs;
using App.Application.Interfaces;
using App.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using NodaTime;

namespace App.Application.Services;

public class TenantManagementService : ITenantManagementService
{
    private readonly IApplicationDbContext _context;
    private readonly IEncryptionService _encryptionService;
    private readonly ICurrentUserProvider _currentUserProvider;

    public TenantManagementService(
        IApplicationDbContext context,
        IEncryptionService encryptionService,
        ICurrentUserProvider currentUserProvider)
    {
        _context = context;
        _encryptionService = encryptionService;
        _currentUserProvider = currentUserProvider;
    }

    public async Task<IEnumerable<TenantDto>> GetAllTenantsAsync()
    {
        if (!_currentUserProvider.IsSuperAdmin)
            throw new UnauthorizedAccessException("Solo el SuperAdmin puede listar todas las empresas.");

        return await _context.Tenants
            .IgnoreQueryFilters()
            .Select(t => new TenantDto(t.Id, t.Name, t.GestorMaxDatabaseId ?? "", t.CreatedAt))
            .ToListAsync();
    }

    public async Task<TenantDto> CreateTenantAsync(string name, string? description = null)
    {
        if (!_currentUserProvider.IsSuperAdmin)
            throw new UnauthorizedAccessException("Solo el SuperAdmin puede crear empresas.");

        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("El nombre de la empresa es requerido.");

        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Name = name
        };

        _context.Tenants.Add(tenant);
        await _context.SaveChangesAsync();

        return new TenantDto(tenant.Id, tenant.Name, null, SystemClock.Instance.GetCurrentInstant());
    }

    public async Task UpdateTenantAsync(TenantDto dto)
    {
        if (!_currentUserProvider.IsSuperAdmin)
            throw new UnauthorizedAccessException("Solo el SuperAdmin puede editar empresas.");

        var tenant = await _context.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == dto.Id);

        if (tenant == null)
            throw new KeyNotFoundException("Empresa no encontrada.");

        tenant.Name = dto.Name;
        tenant.GestorMaxDatabaseId = dto.GestorMaxDatabaseId;

        if (!string.IsNullOrEmpty(dto.GestorMaxApiKey))
        {
            tenant.GestorMaxApiKeyEncrypted = _encryptionService.Encrypt(dto.GestorMaxApiKey);
        }

        await _context.SaveChangesAsync();
    }

    public async Task DeleteTenantAsync(Guid id)
    {
        if (!_currentUserProvider.IsSuperAdmin)
            throw new UnauthorizedAccessException("Solo el SuperAdmin puede eliminar empresas.");

        var tenant = await _context.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == id);

        if (tenant == null)
            throw new KeyNotFoundException("Empresa no encontrada.");

        _context.Tenants.Remove(tenant);
        await _context.SaveChangesAsync();
    }
}
