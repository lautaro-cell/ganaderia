using App.Domain.Common;

namespace App.Domain.Entities;

public enum NormalType { Debe, Haber }

public class Account : BaseAuditableEntity
{
    public Guid TenantId { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public Guid PlanId { get; set; }
    public NormalType NormalType { get; set; }
    public bool IsActive { get; set; } = true;
    
    public Tenant? Tenant { get; set; }
    public PlanCuenta? Plan { get; set; }
}

public class PlanCuenta : BaseAuditableEntity
{
    public Guid TenantId { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    
    public Tenant? Tenant { get; set; }
    public ICollection<Account> Accounts { get; set; } = new List<Account>();
}