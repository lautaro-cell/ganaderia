using GestorGanadero.Server.Application.DTOs;

namespace GestorGanadero.Server.Application.Interfaces;

public interface IUserService
{
    Task<UserDto> GetMyProfileAsync();
    Task<IEnumerable<TenantDto>> GetAvailableTenantsAsync();
    Task<IEnumerable<UserDto>> GetAllUsersAsync();
    Task<Guid> InviteUserAsync(InviteUserRequest request);
    Task UpdateUserAsync(UserDto dto);
    Task DeleteUserAsync(Guid id);
}
