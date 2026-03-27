using GestorGanadero.Server.Domain.Common;

namespace GestorGanadero.Server.Domain.Entities;

public class Tenant : BaseAuditableEntity
{
    public required string Name { get; set; }
    public required string ErpTenantId { get; set; } // Identificador en el ERP
}
