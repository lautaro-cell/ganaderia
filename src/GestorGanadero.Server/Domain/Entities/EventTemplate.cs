using GestorGanadero.Server.Domain.Common;
using GestorGanadero.Server.Domain.Enums;

namespace GestorGanadero.Server.Domain.Entities;

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
