namespace App.Application.DTOs;

public record AccountDto(
    Guid Id,
    string Code,
    string Name,
    Guid PlanId,
    string PlanName,
    string NormalType,
    bool IsActive,
    Guid TenantId
);