using WebApplication1.Application.DTOs;

namespace WebApplication1.Application.Interfaces;

public interface IReportService
{
    Task<IEnumerable<BalanceItemDto>> GetBalanceAsync(Guid? fieldId, DateTime? date, string categoryView);
}
