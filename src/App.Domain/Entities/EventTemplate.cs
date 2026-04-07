using App.Domain.Common;
using App.Domain.Enums;

namespace App.Domain.Entities;

public class EventTemplate : BaseAuditableEntity
{
    public Guid TenantId { get; set; }
    public required string Name { get; set; }
    public EventType EventType { get; set; }
    public required string DebitAccountCode { get; set; }
    public required string CreditAccountCode { get; set; }
    public bool IsActive { get; set; } = true;
    
    public Tenant? Tenant { get; set; }
}

