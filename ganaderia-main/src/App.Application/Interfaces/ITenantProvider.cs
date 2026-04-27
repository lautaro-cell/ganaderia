namespace App.Application.Interfaces;

public interface ITenantProvider
{
    Guid TenantId { get; }
}

