using WebApplication1.Domain.Common;

namespace WebApplication1.Domain.Entities;

public class Tenant : BaseAuditableEntity
{
    public required string Name { get; set; }
    public required string ErpTenantId { get; set; } // Identificador en el ERP
}
