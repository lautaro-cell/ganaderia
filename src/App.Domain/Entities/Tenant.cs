using App.Domain.Common;

namespace App.Domain.Entities;

public class Tenant : BaseAuditableEntity
{
    public required string Name { get; set; }
    public required string ErpTenantId { get; set; } // Identificador en el ERP
}

