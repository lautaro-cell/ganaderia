using App.Application.DTOs;

namespace App.Application.Interfaces;

public interface IErpConnectivityService
{
    Task<VerifyConnectionResult> VerifyConnectionAsync(Guid tenantId, CancellationToken ct = default);
    Task<ErpIntegrationStatusDto?> GetStatusAsync(Guid tenantId, CancellationToken ct = default);
}
