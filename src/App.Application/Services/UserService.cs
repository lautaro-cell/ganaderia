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
            .Include(u => u.UserFields)
            .Select(u => new UserDto(
                u.Id, u.Email, u.TenantId, u.Role,
                u.Name, u.IsActive, u.LastLoginAt,
                u.UserFields.Select(uf => uf.FieldId).ToList()))
            .ToListAsync();
    }

    public async Task<Guid> InviteUserAsync(InviteUserRequest request)
    {
        var role = Enum.TryParse<UserRole>(request.RoleName, true, out var r) ? r : UserRole.Guest;
        var defaultPassword = "password123";
        var hashedPassword = BCrypt.Net.BCrypt.HashPassword(defaultPassword);

        var user = new User
        {
            Email = request.Email,
            Name = request.Name,
            PasswordHash = hashedPassword,
            TenantId = request.TenantId,
            Role = role,
            IsActive = false
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
        user.Name = dto.Name;
        user.Role = dto.Role;
        user.IsActive = dto.IsActive;

        if (dto.AssignedFieldIds != null)
        {
            var existing = await _context.UserFields.Where(uf => uf.UserId == dto.Id).ToListAsync();
            foreach (var uf in existing) _context.UserFields.Remove(uf);
            foreach (var fid in dto.AssignedFieldIds)
                _context.UserFields.Add(new UserField { UserId = dto.Id, FieldId = fid });
        }

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


