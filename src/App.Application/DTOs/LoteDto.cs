namespace App.Application.DTOs;

public record LoteDto(
    Guid Id,
    string Name,
    Guid FieldId,
    IEnumerable<Guid> ActivityIds,
    string? FieldName);

