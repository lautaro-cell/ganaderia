using App.Application.DTOs;

namespace App.Application.Interfaces;

public interface ILoteService
{
    Task<IEnumerable<LoteDto>> GetLotesByFieldAsync(Guid fieldId);
    Task<Guid> CreateLoteAsync(LoteDto dto);
    Task UpdateLoteAsync(LoteDto dto);
    Task DeleteLoteAsync(Guid id);
    Task SaveGeometryAsync(Guid loteId, string geoJson);
}

