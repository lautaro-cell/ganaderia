using Microsoft.EntityFrameworkCore;
using GestorGanadero.Server.Application.DTOs;
using GestorGanadero.Server.Application.Interfaces;
using GestorGanadero.Server.Infrastructure.Persistence;

namespace GestorGanadero.Server.Application.Services;

public class ReportService : IReportService
{
    private readonly GestorGanaderoDbContext _context;

    public ReportService(GestorGanaderoDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<BalanceItemDto>> GetBalanceAsync(Guid? fieldId, DateTime? date, string categoryView)
    {
        // Consulta simplificada para obtener el balance de stock (Cabezas y Kg)
        // Agrupa por Campo, Actividad y Categoría.
        
        var query = _context.LivestockEvents
            .Include(e => e.Field)
            .Include(e => e.Activity)
            .Include(e => e.Category)
            .AsQueryable();

        if (fieldId.HasValue)
            query = query.Where(e => e.FieldId == fieldId);

        if (date.HasValue)
            query = query.Where(e => e.EventDate <= date.Value);

        // Agrupación para calcular saldos
        var result = await query
            .GroupBy(e => new { 
                FieldName = e.Field != null ? e.Field.Name : "Sin Campo",
                ActivityName = e.Activity != null ? e.Activity.Name : "Sin Actividad",
                CategoryName = e.Category != null ? e.Category.Name : "Sin Categoría"
            })
            .Select(g => new BalanceItemDto(
                g.Key.FieldName,
                g.Key.CategoryName,
                g.Sum(e => e.HeadCount), // Simplificación: suma simple. En real restaría si es venta/muerte.
                g.Sum(e => e.EstimatedWeightKg),
                g.Key.ActivityName
            ))
            .ToListAsync();

        return result;
    }
}
