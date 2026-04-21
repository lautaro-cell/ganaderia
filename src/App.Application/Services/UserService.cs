using NodaTime;
using Microsoft.EntityFrameworkCore;
using App.Application.DTOs;
using App.Application.Interfaces;
using App.Domain.Entities;
using App.Domain.Enums;

using BCrypt.Net;

namespace App.Application.Services;

public class UserService : IUserService
{
    private readonly IApplicationDbContext _context;
    private readonly ITenantProvider _tenantProvider;
    private readonly IEncryptionService _encryptionService;

    public UserService(IApplicationDbContext context, ITenantProvider tenantProvider, IEncryptionService encryptionService)
    {
        _context = context;
        _tenantProvider = tenantProvider;
        _encryptionService = encryptionService;
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
            .Select(t => new TenantDto(t.Id, t.Name, t.GestorMaxDatabaseId ?? "", t.CreatedAt))
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
        
        // TODO: Enviar correo de invitación para que el usuario establezca su contraseña
        var defaultPassword = "password123"; // Contraseña temporal, el usuario deberá cambiarla.
        var hashedPassword = BCrypt.Net.BCrypt.HashPassword(defaultPassword);

        var user = new User
        {
            Email = request.Email,
            PasswordHash = hashedPassword,
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
        // TODO: Manejar actualización de contraseña si es necesario

        await _context.SaveChangesAsync();
    }

    public async Task UpdateTenantAsync(TenantDto dto)
    {
        var tenant = await _context.Tenants.FindAsync(dto.Id);
        if (tenant == null) throw new KeyNotFoundException("Empresa no encontrada");

        tenant.Name = dto.Name;
        tenant.GestorMaxDatabaseId = dto.GestorMaxDatabaseId;
        
        if (!string.IsNullOrEmpty(dto.GestorMaxApiKey))
        {
            tenant.GestorMaxApiKeyEncrypted = _encryptionService.Encrypt(dto.GestorMaxApiKey);
        }

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


