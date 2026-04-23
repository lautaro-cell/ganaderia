using App.Application.DTOs;

namespace App.Application.Interfaces;

public interface ICompanyConfigurationService
{
    Task SaveAsync(SaveErpConfigurationCommand command, CancellationToken ct = default);
}
