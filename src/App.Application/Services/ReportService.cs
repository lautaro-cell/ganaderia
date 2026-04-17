using NodaTime;
using Microsoft.EntityFrameworkCore;
using App.Application.DTOs;
using App.Application.Interfaces;
using App.Domain.Entities;
using App.Domain.Enums;

namespace App.Application.Services;

public class ReportService : IReportService
{
    private readonly IApplicationDbContext _context;

    public ReportService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<BalanceItemDto>> GetBalanceAsync(Guid? fieldId, Instant? date, string categoryView)
    {
        var query = _context.AccountingDrafts
            .Include(a => a.Field)
            .Include(a => a.Activity)
            .Include(a => a.Category)
            .Include(a => a.LivestockEvent)
            .AsQueryable();

        if (fieldId.HasValue)
            query = query.Where(a => a.FieldId == fieldId);

        if (date.HasValue)
            query = query.Where(a => a.LivestockEvent != null && a.LivestockEvent.EventDate <= date.Value);

        var data = await query.ToListAsync();

        // Si la vista es "gestor", aplicamos el mapeo
        if (categoryView == "gestor")
        {
            var mappings = await _context.CategoryMappings.ToListAsync();
            var gestorCategories = await _context.AnimalCategories
                .Where(c => c.Type == CategoryType.Gestor)
                .ToListAsync();

            var resultGestor = data
                .GroupBy(a => new {
                    a.AccountCode,
                    FieldName = a.Field != null ? a.Field.Name : "Sin Campo",
                    ActivityName = a.Activity != null ? a.Activity.Name : "Sin Actividad",
                    CategoryName = ResolveGestorCategoryName(a.CategoryId, mappings, gestorCategories, a.Category?.Name ?? "Sin Categoría")
                })
                .Select(g => new BalanceItemDto(
                    g.Key.FieldName,
                    g.Key.CategoryName,
                    g.Sum(a => a.EntryType == "DEBE" ? a.HeadCount : -a.HeadCount),
                    g.Sum(a => a.EntryType == "DEBE" ? (a.WeightKg ?? 0) : -(a.WeightKg ?? 0)),
                    g.Key.ActivityName,
                    g.Key.AccountCode,
                    g.Sum(a => a.DebitAmount),
                    g.Sum(a => a.CreditAmount),
                    g.Sum(a => a.DebitAmount - a.CreditAmount)
                ));

            return resultGestor;
        }

        var result = data
            .GroupBy(a => new {
                a.AccountCode,
                FieldName = a.Field != null ? a.Field.Name : "Sin Campo",
                ActivityName = a.Activity != null ? a.Activity.Name : "Sin Actividad",
                CategoryName = a.Category != null ? a.Category.Name : "Sin Categoría"
            })
            .Select(g => new BalanceItemDto(
                g.Key.FieldName,
                g.Key.CategoryName,
                g.Sum(a => a.EntryType == "DEBE" ? a.HeadCount : -a.HeadCount),
                g.Sum(a => a.EntryType == "DEBE" ? (a.WeightKg ?? 0) : -(a.WeightKg ?? 0)),
                g.Key.ActivityName,
                g.Key.AccountCode,
                g.Sum(a => a.DebitAmount),
                g.Sum(a => a.CreditAmount),
                g.Sum(a => a.DebitAmount - a.CreditAmount)
            ));

        return result;
    }

    private string ResolveGestorCategoryName(Guid? clienteCatId, List<CategoryMapping> mappings, List<AnimalCategory> gestorCategories, string fallbackName)
    {
        if (!clienteCatId.HasValue) return fallbackName;

        var mapping = mappings.FirstOrDefault(m => m.CategoriaClienteId == clienteCatId.Value);
        if (mapping == null) return fallbackName;

        var gestorCat = gestorCategories.FirstOrDefault(c => c.ExternalId == mapping.CategoriaGestorId);
        return gestorCat?.Name ?? fallbackName;
    }

    public async Task<IEnumerable<LedgerEntryDto>> GetLedgerAsync(Instant? startDate, Instant? endDate, int pageIndex, int pageSize, string searchTerm, Guid tenantId)
    {
        var query = _context.AccountingDrafts
            .Include(a => a.LivestockEvent)
            .Where(a => a.TenantId == tenantId)
            .AsQueryable();

        if (startDate.HasValue)
            query = query.Where(a => a.LivestockEvent != null && a.LivestockEvent.EventDate >= startDate.Value);

        if (endDate.HasValue)
            query = query.Where(a => a.LivestockEvent != null && a.LivestockEvent.EventDate <= endDate.Value);

        if (!string.IsNullOrWhiteSpace(searchTerm))
            query = query.Where(a => a.Concept.Contains(searchTerm) || a.AccountCode.Contains(searchTerm));

        var entries = await query
            .OrderBy(a => a.LivestockEvent != null ? a.LivestockEvent.EventDate : a.CreatedAt)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .Select(a => new LedgerEntryDto(
                a.Id,
                a.LivestockEvent != null ? a.LivestockEvent.EventDate : a.CreatedAt,
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
