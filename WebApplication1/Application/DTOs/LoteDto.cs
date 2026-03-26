namespace WebApplication1.Application.DTOs;

public record LoteDto(
    Guid Id,
    string Name,
    Guid FieldId,
    IEnumerable<Guid> ActivityIds,
    string? FieldName);
