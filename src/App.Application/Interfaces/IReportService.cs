using App.Application.DTOs;
using NodaTime;

namespace App.Application.Interfaces;

public interface IReportService
{
    Task<IEnumerable<BalanceItemDto>> GetBalanceAsync(
        Guid? fieldId,
        Instant? startDate,
        Instant? endDate,
        string categoryView,
        Guid tenantId,
        Guid? categoryId);

    Task<IEnumerable<LedgerEntryDto>> GetLedgerAsync(
        Instant? startDate, Instant? endDate,
        int pageIndex, int pageSize,
        string? searchTerm, Guid tenantId,
        string? accountCode, Guid? categoryId, Guid? fieldId);
}
