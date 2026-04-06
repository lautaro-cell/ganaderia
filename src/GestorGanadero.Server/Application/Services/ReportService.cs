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
        var query = _context.LivestockEvents
            .Include(e => e.Field)
            .Include(e => e.Activity)
            .Include(e => e.Category)
            .AsQueryable();

        if (fieldId.HasValue)
            query = query.Where(e => e.FieldId == fieldId);

        if (date.HasValue)
            query = query.Where(e => e.EventDate <= date.Value);

        var result = await query
            .GroupBy(e => new { 
                FieldName = e.Field != null ? e.Field.Name : "Sin Campo",
                ActivityName = e.Activity != null ? e.Activity.Name : "Sin Actividad",
                CategoryName = e.Category != null ? e.Category.Name : "Sin Categoría"
            })
            .Select(g => new BalanceItemDto(
                g.Key.FieldName,
                g.Key.CategoryName,
                g.Sum(e => e.HeadCount),
                g.Sum(e => e.EstimatedWeightKg),
                g.Key.ActivityName
            ))
            .ToListAsync();

        return result;
    }

    public async Task<IEnumerable<LedgerEntryDto>> GetLedgerAsync(DateTime? startDate, DateTime? endDate, int pageIndex, int pageSize, string searchTerm, Guid tenantId)
    {
        var query = _context.AccountingDrafts
            .Include(a => a.LivestockEvent)
            .Where(a => a.TenantId == tenantId)
            .AsQueryable();

        if (startDate.HasValue)
            query = query.Where(a => a.CreatedAt >= startDate.Value);

        if (endDate.HasValue)
            query = query.Where(a => a.CreatedAt <= endDate.Value);

        if (!string.IsNullOrWhiteSpace(searchTerm))
            query = query.Where(a => a.Concept.Contains(searchTerm) || a.AccountCode.Contains(searchTerm));

        var entries = await query
            .OrderBy(a => a.CreatedAt)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .Select(a => new LedgerEntryDto(
                a.Id,
                a.CreatedAt.DateTime,
                a.Concept,
                a.DebitAmount > 0 ? a.DebitAmount : a.CreditAmount,
                a.AccountCode,
                a.LivestockEvent != null ? a.LivestockEvent.Status.ToString() : "Draft",
                a.EntryType,
                a.HeadCount,
                a.WeightKg ?? 0
            ))
            .ToListAsync();

        return entries;
    }
}
