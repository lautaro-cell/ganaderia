using App.Domain.Common;
using App.Domain.Enums;
using NodaTime;

namespace App.Domain.Entities;

public class LivestockEvent : BaseAuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid EventTemplateId { get; set; }
    public required string CostCenterCode { get; set; } // Campo code (legacy)
    public Guid? FieldId { get; set; }           // FK to Field entity
    public Guid? DestinationFieldId { get; set; }
    public Guid? ActivityId { get; set; }         // FK to Activity entity
    public Guid? OriginActivityId { get; set; }
    public Guid? DestinationActivityId { get; set; }
    public Guid? CategoryId { get; set; }         // FK to AnimalCategory entity
    public Guid? OriginCategoryId { get; set; }
    public Guid? DestinationCategoryId { get; set; }
    public int HeadCount { get; set; }
    public decimal EstimatedWeightKg { get; set; }
    public decimal? WeightPerHead { get; set; }
    public decimal TotalAmount { get; set; }
    public Instant EventDate { get; set; }
    public LivestockEventStatus Status { get; set; } = LivestockEventStatus.Draft;
    public string? ErpTransactionId { get; set; }
    public string? Observations { get; set; }

    public Tenant? Tenant { get; set; }
    public EventTemplate? EventTemplate { get; set; }
    public Field? Field { get; set; }
    public Activity? Activity { get; set; }
    public AnimalCategory? Category { get; set; }
    public ICollection<AccountingDraft> AccountingDrafts { get; set; } = new List<AccountingDraft>();
}
