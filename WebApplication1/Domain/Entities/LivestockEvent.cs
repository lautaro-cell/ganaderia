using WebApplication1.Domain.Common;
using WebApplication1.Domain.Enums;

namespace WebApplication1.Domain.Entities;

public class LivestockEvent : BaseAuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid EventTemplateId { get; set; }
    public required string CostCenterCode { get; set; } // Lote/Campo
    public int HeadCount { get; set; }
    public decimal EstimatedWeightKg { get; set; }
    public decimal TotalAmount { get; set; } // Valorización del evento
    public DateTimeOffset EventDate { get; set; }
    public LivestockEventStatus Status { get; set; } = LivestockEventStatus.Draft;
    public string? ErpTransactionId { get; set; } // Nullable, filled on sync
    
    public Tenant? Tenant { get; set; }
    public EventTemplate? EventTemplate { get; set; }
    public ICollection<AccountingDraft> AccountingDrafts { get; set; } = new List<AccountingDraft>();
}
