using App.Domain.Common;

namespace App.Domain.Entities;

public class AccountingDraft : BaseAuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid LivestockEventId { get; set; }
    public required string AccountCode { get; set; }
    public required string Concept { get; set; }
    public decimal DebitAmount { get; set; }
    public decimal CreditAmount { get; set; }
    public string EntryType { get; set; } = string.Empty; // "DEBE" or "HABER"

    // Physical stock data (migrated from Node.js asientos)
    public int HeadCount { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? WeightPerHead { get; set; }
    public Guid? FieldId { get; set; }

    public Tenant? Tenant { get; set; }
    public LivestockEvent? LivestockEvent { get; set; }
}

