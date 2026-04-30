namespace App.Application.DTOs;

public record PlanCuentaDto(
    Guid Id,
    string Code,
    string Name,
    Guid TenantId
);
