using App.Application.DTOs;

namespace App.Application.Interfaces;

public interface IErpAccountQueryService
{
    /// <summary>
    /// Retorna las cuentas del ERP del tenant aptas para usarse como DEBE/HABER en un EventTemplate.
    /// Lanza InvalidOperationException si el tenant no tiene GestorMax configurado.
    /// </summary>
    Task<IEnumerable<ErpAccountDto>> GetAccountsForSelectorAsync(Guid tenantId);
}
