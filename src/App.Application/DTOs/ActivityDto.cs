namespace App.Application.DTOs;

public record ActivityDto(
    Guid Id,
    string Name,
    bool IsGlobal,
    Guid? TenantId);

