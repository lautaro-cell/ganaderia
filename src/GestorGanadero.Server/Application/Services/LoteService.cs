using Microsoft.EntityFrameworkCore;
using GestorGanadero.Server.Application.DTOs;
using GestorGanadero.Server.Application.Interfaces;
using GestorGanadero.Server.Domain.Entities;
using GestorGanadero.Server.Infrastructure.Persistence;

namespace GestorGanadero.Server.Application.Services;

public class LoteService : ILoteService
{
    private readonly GestorGanaderoDbContext _context;

    public LoteService(GestorGanaderoDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<LoteDto>> GetLotesByFieldAsync(Guid fieldId)
    {
        return await _context.Lotes
            .Include(l => l.Activities)
            .Include(l => l.Field)
            .Where(l => l.FieldId == fieldId)
            .Select(l => new LoteDto(
                l.Id, l.Name, l.FieldId, 
                l.Activities.Select(a => a.Id), l.Field!.Name))
            .ToListAsync();
    }

    public async Task<Guid> CreateLoteAsync(LoteDto dto)
    {
        var lote = new Lote
        {
            Name = dto.Name,
            FieldId = dto.FieldId
        };
        
        if (dto.ActivityIds != null && dto.ActivityIds.Any())
        {
            var activities = await _context.Activities
                .Where(a => dto.ActivityIds.Contains(a.Id))
                .ToListAsync();
            foreach(var act in activities) lote.Activities.Add(act);
        }

        _context.Lotes.Add(lote);
        await _context.SaveChangesAsync();
        return lote.Id;
    }

    public async Task UpdateLoteAsync(LoteDto dto)
    {
        var lote = await _context.Lotes
            .Include(l => l.Activities)
            .FirstOrDefaultAsync(l => l.Id == dto.Id);
            
        if (lote == null) throw new KeyNotFoundException("Lote no encontrado");
        
        lote.Name = dto.Name;
        lote.FieldId = dto.FieldId;
        
        lote.Activities.Clear();
        if (dto.ActivityIds != null && dto.ActivityIds.Any())
        {
            var activities = await _context.Activities
                .Where(a => dto.ActivityIds.Contains(a.Id))
                .ToListAsync();
            foreach(var act in activities) lote.Activities.Add(act);
        }
        
        await _context.SaveChangesAsync();
    }

    public async Task DeleteLoteAsync(Guid id)
    {
        var lote = await _context.Lotes.FindAsync(id);
        if (lote != null)
        {
            _context.Lotes.Remove(lote);
            await _context.SaveChangesAsync();
        }
    }

    public async Task SaveGeometryAsync(Guid loteId, string geoJson)
    {
        // Placeholder for GIS logic
        await Task.CompletedTask;
    }
}
