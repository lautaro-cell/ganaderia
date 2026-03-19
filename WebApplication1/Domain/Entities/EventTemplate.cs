using WebApplication1.Domain.Common;
using WebApplication1.Domain.Enums;

namespace WebApplication1.Domain.Entities;

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
