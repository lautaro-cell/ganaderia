using App.Application.DTOs;
using App.Application.Interfaces;
using App.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using NodaTime;

namespace App.Application.Services;

public class ReportService : IReportService
{
    private readonly IApplicationDbContext _context;

    public ReportService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<BalanceItemDto>> GetBalanceAsync(
        Guid? fieldId,
        Instant? startDate,
        Instant? endDate,
        string categoryView,
        Guid tenantId,
        Guid? categoryId)
    {
        var query = _context.AccountingDrafts
            .AsNoTracking()
            .Where(a => a.TenantId == tenantId)
            .AsQueryable();

        if (fieldId.HasValue)
            query = query.Where(a => a.FieldId == fieldId.Value);

        if (categoryId.HasValue)
            query = query.Where(a => a.CategoryId == categoryId.Value);

        if (startDate.HasValue)
            query = query.Where(a => a.LivestockEvent != null && a.LivestockEvent.EventDate >= startDate.Value);

        if (endDate.HasValue)
            query = query.Where(a => a.LivestockEvent != null && a.LivestockEvent.EventDate <= endDate.Value);

        if (categoryView == "gestor")
        {
            var gestorQuery = from a in query
                              join m in _context.CategoryMappings.AsNoTracking()
                                  on a.CategoryId equals m.CategoriaClienteId into am
                              from m in am.DefaultIfEmpty()
                              join gc in _context.AnimalCategories.AsNoTracking()
                                      .Where(c => c.Type == CategoryType.Gestor && c.TenantId == tenantId)
                                  on m.CategoriaGestorId equals gc.ExternalId into agc
                              from gc in agc.DefaultIfEmpty()
                              group a by new
                              {
                                  a.AccountCode,
                                  FieldName = a.Field != null ? a.Field.Name : "Sin Campo",
                                  ActivityName = a.Activity != null ? a.Activity.Name : "Sin Actividad",
                                  CategoryName = gc != null ? gc.Name : (a.Category != null ? a.Category.Name : "Sin Categoría")
                              } into g
                              select new BalanceItemDto(
                                  g.Key.FieldName,
                                  g.Key.CategoryName,
                                  g.Sum(a => a.EntryType == "DEBE" ? a.HeadCount : -a.HeadCount),
                                  g.Sum(a => a.EntryType == "DEBE" ? (a.WeightKg ?? 0) : -(a.WeightKg ?? 0)),
                                  g.Key.ActivityName,
                                  g.Key.AccountCode,
                                  g.Sum(a => a.DebitAmount),
                                  g.Sum(a => a.CreditAmount),
                                  g.Sum(a => a.DebitAmount - a.CreditAmount),
                                  g.Sum(a => a.WeightKg ?? 0),
                                  DeriveGroup(g.Key.AccountCode));

            return await gestorQuery.ToListAsync();
        }

        var resultQuery = query
            .GroupBy(a => new
            {
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
                g.Sum(a => a.DebitAmount - a.CreditAmount),
                g.Sum(a => a.WeightKg ?? 0),
                DeriveGroup(g.Key.AccountCode)));

        return await resultQuery.ToListAsync();
    }

    public async Task<IEnumerable<LedgerEntryDto>> GetLedgerAsync(
        Instant? startDate, Instant? endDate,
        int pageIndex, int pageSize,
        string? searchTerm, Guid tenantId,
        string? accountCode, Guid? categoryId, Guid? fieldId)
    {
        var query = _context.AccountingDrafts
            .AsNoTracking()
            .Where(a => a.TenantId == tenantId)
            .AsQueryable();

        if (startDate.HasValue)
            query = query.Where(a => a.LivestockEvent != null && a.LivestockEvent.EventDate >= startDate.Value);

        if (endDate.HasValue)
            query = query.Where(a => a.LivestockEvent != null && a.LivestockEvent.EventDate <= endDate.Value);

        if (!string.IsNullOrWhiteSpace(searchTerm))
            query = query.Where(a => a.Concept.Contains(searchTerm) || a.AccountCode.Contains(searchTerm));

        if (!string.IsNullOrWhiteSpace(accountCode))
            query = query.Where(a => a.AccountCode == accountCode);

        if (categoryId.HasValue)
            query = query.Where(a => a.CategoryId == categoryId.Value);

        if (fieldId.HasValue)
            query = query.Where(a => a.FieldId == fieldId.Value);

        return await query
            .OrderByDescending(a => a.LivestockEvent != null ? a.LivestockEvent.EventDate : a.CreatedAt)
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
                a.WeightKg ?? 0,
                a.LivestockEventId,
                a.Field != null ? a.Field.Name : "",
                a.Category != null ? a.Category.Name : "",
                a.DebitAmount,
                a.CreditAmount))
            .ToListAsync();
    }

    private static string DeriveGroup(string accountCode)
    {
        if (string.IsNullOrEmpty(accountCode)) return "RESULTADO";
        return accountCode[0] switch
        {
            '1' => "ACTIVO",
            '2' => "PASIVO",
            _ => "RESULTADO"
        };
    }
}

