using App.Domain.Common;
using App.Domain.Enums;

namespace App.Domain.Entities;

public class User : BaseAuditableEntity
{
    public required string Email { get; set; }
    public required string PasswordHash { get; set; } // Añadido para almacenar el hash de la contraseña
    public required Guid TenantId { get; set; }
    public UserRole Role { get; set; }
    
    public Tenant? Tenant { get; set; }
}

