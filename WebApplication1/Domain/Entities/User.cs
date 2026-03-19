using WebApplication1.Domain.Common;
using WebApplication1.Domain.Enums;

namespace WebApplication1.Domain.Entities;

public class User : BaseAuditableEntity
{
    public required string Email { get; set; }
    public required Guid TenantId { get; set; }
    public UserRole Role { get; set; }
    
    public Tenant? Tenant { get; set; }
}
