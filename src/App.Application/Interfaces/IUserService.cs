using App.Application.DTOs;

namespace App.Application.Interfaces;

public interface IUserService
{
    Task<UserDto> GetMyProfileAsync();
    Task<IEnumerable<TenantDto>> GetAvailableTenantsAsync();
    Task<IEnumerable<UserDto>> GetAllUsersAsync();
    Task<Guid> InviteUserAsync(InviteUserRequest request);
    Task UpdateUserAsync(UserDto dto);
    Task DeleteUserAsync(Guid id);
    Task SetPasswordAsync(string token, string newPassword);

    // Tenant
    Task UpdateTenantAsync(TenantDto dto);
}

