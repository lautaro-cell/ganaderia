using App.Domain.Common;
using App.Domain.Enums;

namespace App.Domain.Entities;

public class AccountConfiguration : BaseAuditableEntity
{
    public Guid TenantId { get; set; }
    public EventType EventType { get; set; }
    public required string DebitAccountCode { get; set; }
    public required string CreditAccountCode { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    
    public Tenant? Tenant { get; set; }
}