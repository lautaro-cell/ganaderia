using GestorGanadero.Server.Domain.Common;
using GestorGanadero.Server.Domain.Enums;

namespace GestorGanadero.Server.Domain.Entities;

public class LivestockEvent : BaseAuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid EventTemplateId { get; set; }
    public required string CostCenterCode { get; set; } // Lote/Campo code (legacy)
    public Guid? FieldId { get; set; }           // FK to Field entity
    public Guid? LoteId { get; set; }            // FK to Lote entity
    public Guid? ActivityId { get; set; }         // FK to Activity entity
    public Guid? CategoryId { get; set; }         // FK to AnimalCategory entity
    public int HeadCount { get; set; }
    public decimal EstimatedWeightKg { get; set; }
    public decimal? WeightPerHead { get; set; }
    public decimal TotalAmount { get; set; }
    public DateTimeOffset EventDate { get; set; }
    public LivestockEventStatus Status { get; set; } = LivestockEventStatus.Draft;
    public string? ErpTransactionId { get; set; }
    public string? Observations { get; set; }

    public Tenant? Tenant { get; set; }
    public EventTemplate? EventTemplate { get; set; }
    public Field? Field { get; set; }
    public Lote? Lote { get; set; }
    public Activity? Activity { get; set; }
    public AnimalCategory? Category { get; set; }
    public ICollection<AccountingDraft> AccountingDrafts { get; set; } = new List<AccountingDraft>();
}
