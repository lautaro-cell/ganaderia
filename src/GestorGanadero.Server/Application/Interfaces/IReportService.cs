using GestorGanadero.Server.Application.DTOs;

namespace GestorGanadero.Server.Application.Interfaces;

public interface IReportService
{
    Task<IEnumerable<BalanceItemDto>> GetBalanceAsync(Guid? fieldId, DateTime? date, string categoryView);
    Task<IEnumerable<LedgerEntryDto>> GetLedgerAsync(DateTime? startDate, DateTime? endDate, int pageIndex, int pageSize, string searchTerm, Guid tenantId);
}
