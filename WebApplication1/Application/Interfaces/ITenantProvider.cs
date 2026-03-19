namespace WebApplication1.Application.Interfaces;

public interface ITenantProvider
{
    Guid TenantId { get; }
}
