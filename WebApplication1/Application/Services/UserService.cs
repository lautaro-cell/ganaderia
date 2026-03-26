using Microsoft.EntityFrameworkCore;
using WebApplication1.Application.DTOs;
using WebApplication1.Application.Interfaces;
using WebApplication1.Domain.Entities;
using WebApplication1.Domain.Enums;
using WebApplication1.Infrastructure.Persistence;

namespace WebApplication1.Application.Services;

public class UserService : IUserService
{
    private readonly GestorGanaderoDbContext _context;
    private readonly ITenantProvider _tenantProvider;

    public UserService(GestorGanaderoDbContext context, ITenantProvider tenantProvider)
    {
        _context = context;
        _tenantProvider = tenantProvider;
    }

    public async Task<UserDto> GetMyProfileAsync()
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.TenantId == _tenantProvider.TenantId);
            
        if (user == null) throw new KeyNotFoundException("Usuario no encontrado en el tenant actual");
        
        return new UserDto(user.Id, user.Email, user.TenantId, user.Role);
    }

    public async Task<IEnumerable<TenantDto>> GetAvailableTenantsAsync()
    {
        // En una implementación real, esto consultaría a qué Tenants tiene acceso el usuario (vía tabla intermedia)
        // Por ahora devolvemos todos los Tenants como simplificación para el MVP de migración.
        return await _context.Tenants
            .Select(t => new TenantDto(t.Id, t.Name, t.ErpTenantId, t.CreatedAt))
            .ToListAsync();
    }

    public async Task<IEnumerable<UserDto>> GetAllUsersAsync()
    {
        return await _context.Users
            .Select(u => new UserDto(u.Id, u.Email, u.TenantId, u.Role))
            .ToListAsync();
    }

    public async Task<Guid> InviteUserAsync(InviteUserRequest request)
    {
        var role = Enum.TryParse<UserRole>(request.RoleName, true, out var r) ? r : UserRole.Guest;
        
        var user = new User
        {
            Email = request.Email,
            TenantId = request.TenantId,
            Role = role
        };
        
        _context.Users.Add(user);
        await _context.SaveChangesAsync();
        return user.Id;
    }

    public async Task UpdateUserAsync(UserDto dto)
    {
        var user = await _context.Users.FindAsync(dto.Id);
        if (user == null) throw new KeyNotFoundException("Usuario no encontrado");
        
        user.Email = dto.Email;
        user.Role = dto.Role;
        
        await _context.SaveChangesAsync();
    }

    public async Task DeleteUserAsync(Guid id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user != null)
        {
            _context.Users.Remove(user);
            await _context.SaveChangesAsync();
        }
    }
}
