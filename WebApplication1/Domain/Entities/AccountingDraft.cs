using WebApplication1.Domain.Common;

namespace WebApplication1.Domain.Entities;

public class AccountingDraft : BaseAuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid LivestockEventId { get; set; }
    public required string AccountCode { get; set; }
    public required string Concept { get; set; }
    public decimal DebitAmount { get; set; }
    public decimal CreditAmount { get; set; }
    
    public Tenant? Tenant { get; set; }
    public LivestockEvent? LivestockEvent { get; set; }
}
