using GestorGanadero.Server.Application.DTOs;

namespace GestorGanadero.Server.Application.Interfaces;

public interface IReportService
{
    Task<IEnumerable<BalanceItemDto>> GetBalanceAsync(Guid? fieldId, DateTime? date, string categoryView);
}
