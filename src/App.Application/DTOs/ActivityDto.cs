namespace App.Application.DTOs;

public record ActivityDto(
    Guid Id,
    string Name,
    bool IsGlobal,
    Guid? TenantId,
    string? Description = null,
    List<Guid>? CategoryIds = null,
    List<Guid>? EventTypeIds = null);

