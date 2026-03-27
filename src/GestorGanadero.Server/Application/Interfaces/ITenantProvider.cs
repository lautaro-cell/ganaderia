namespace GestorGanadero.Server.Application.Interfaces;

public interface ITenantProvider
{
    Guid TenantId { get; }
}
