using App.Application.DTOs;

namespace App.Application.Interfaces;

public interface ITenantManagementService
{
    Task<IEnumerable<TenantDto>> GetAllTenantsAsync();
    Task<TenantDto> CreateTenantAsync(string name, string? description = null);
    Task UpdateTenantAsync(TenantDto dto);
    Task DeleteTenantAsync(Guid id);
}
