using App.Application.DTOs;
using NodaTime;

namespace App.Application.Interfaces;

public interface IReportService
{
    Task<IEnumerable<BalanceItemDto>> GetBalanceAsync(Guid? fieldId, Instant? date, string categoryView);
    Task<IEnumerable<LedgerEntryDto>> GetLedgerAsync(Instant? startDate, Instant? endDate, int pageIndex, int pageSize, string searchTerm, Guid tenantId);
}
