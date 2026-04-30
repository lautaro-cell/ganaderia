using App.Domain.Common;
using App.Domain.Enums;
using NodaTime;

namespace App.Domain.Entities;

public class User : BaseAuditableEntity
{
    public required string Email { get; set; }
    public required string PasswordHash { get; set; }
    public string? Name { get; set; }
    public required Guid TenantId { get; set; }
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    public Instant? LastLoginAt { get; set; }
    public string? PasswordResetToken { get; set; }
    public Instant? PasswordResetTokenExpiry { get; set; }

    public Tenant? Tenant { get; set; }
    public ICollection<UserField> UserFields { get; set; } = new List<UserField>();
}

