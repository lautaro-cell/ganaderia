using Grpc.Core;
using Google.Protobuf.WellKnownTypes;
using App.Application.Interfaces;
using GestorGanadero.Services.Reporting.Contracts;
using Microsoft.Extensions.Logging;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using System;
using NodaTime;

namespace GestorGanadero.Server.Grpc;

public class ReportingServiceImplementation : ReportingService.ReportingServiceBase
{
    private readonly IReportService _reportService;
    private readonly ILogger<ReportingServiceImplementation> _logger;

    public ReportingServiceImplementation(IReportService reportService, ILogger<ReportingServiceImplementation> logger)
    {
        _reportService = reportService;
        _logger = logger;
    }

    public override async Task<BalanceReport> GetBalance(GetBalanceRequest request, ServerCallContext context)
    {
        var sw = Stopwatch.StartNew();
        var tenantId   = string.IsNullOrEmpty(request.TenantId)   ? Guid.Empty   : Guid.Parse(request.TenantId);
        var fieldId    = string.IsNullOrEmpty(request.FieldId)     ? (Guid?)null  : Guid.Parse(request.FieldId);
        var categoryId = string.IsNullOrEmpty(request.CategoryId)  ? (Guid?)null  : Guid.Parse(request.CategoryId);
        var startDate  = request.StartDate == null ? (Instant?)null : Instant.FromDateTimeUtc(request.StartDate.ToDateTime());
        var endDate    = request.Date      == null ? (Instant?)null : Instant.FromDateTimeUtc(request.Date.ToDateTime());

        var balance = await _reportService.GetBalanceAsync(
            fieldId, startDate, endDate, request.CategoryView, tenantId, categoryId);

        var response = new BalanceReport { ReportDate = request.Date ?? Timestamp.FromDateTime(DateTime.UtcNow) };
        response.Items.AddRange(balance.Select(b => new BalanceItem
        {
            FieldName          = b.FieldName ?? "",
            CategoryName       = b.CategoryName ?? "",
            HeadCount          = b.HeadCount,
            TotalWeight        = (double)b.TotalWeight,
            ActivityName       = b.ActivityName ?? "",
            AccountCode        = b.AccountCode ?? "",
            DebitTotal         = (double)b.DebitTotal,
            CreditTotal        = (double)b.CreditTotal,
            NetBalance         = (double)b.NetBalance,
            AccountGroup       = b.AccountGroup,
            WeightKgMovement   = (double)b.WeightKgMovement,
        }));
        _logger.LogInformation("GetBalance | TenantId={TenantId} | Items={Count} | Duration={DurationMs}ms",
            request.TenantId, response.Items.Count, sw.ElapsedMilliseconds);
        return response;
    }

    public override async Task GetLedger(LedgerFilter request, IServerStreamWriter<LedgerEntry> responseStream, ServerCallContext context)
    {
        var sw = Stopwatch.StartNew();
        int written = 0;
        var tenantId   = string.IsNullOrEmpty(request.TenantId)   ? Guid.Empty  : Guid.Parse(request.TenantId);
        var categoryId = string.IsNullOrEmpty(request.CategoryId) ? (Guid?)null : Guid.Parse(request.CategoryId);
        var fieldId    = string.IsNullOrEmpty(request.FieldId)    ? (Guid?)null : Guid.Parse(request.FieldId);
        var pageSize = request.PageSize > 0 ? Math.Min(request.PageSize, 500) : 500;
        var pageIndex = request.PageIndex >= 0 ? request.PageIndex : 0;

        var entries = await _reportService.GetLedgerAsync(
            request.StartDate == null ? (Instant?)null : Instant.FromDateTimeUtc(request.StartDate.ToDateTime()),
            request.EndDate   == null ? (Instant?)null : Instant.FromDateTimeUtc(request.EndDate.ToDateTime()),
            pageIndex,
            pageSize,
            request.SearchTerm,
            tenantId,
            string.IsNullOrEmpty(request.AccountCode) ? null : request.AccountCode,
            categoryId,
            fieldId);

        foreach (var entry in entries)
        {
            if (context.CancellationToken.IsCancellationRequested) break;
            written++;
            await responseStream.WriteAsync(new LedgerEntry
            {
                Id               = entry.Id.ToString(),
                Date             = Timestamp.FromDateTimeOffset(entry.Date.ToDateTimeOffset()),
                Description      = entry.Description ?? "",
                Amount           = (double)entry.Amount,
                AccountCode      = entry.AccountCode ?? "",
                Status           = entry.Status,
                EntryType        = entry.EntryType,
                HeadCount        = entry.HeadCount,
                WeightKg         = entry.WeightKg.ToString(),
                LivestockEventId = entry.LivestockEventId.ToString(),
                FieldName        = entry.FieldName ?? "",
                CategoryName     = entry.CategoryName ?? "",
                DebitAmount      = (double)entry.DebitAmount,
                CreditAmount     = (double)entry.CreditAmount,
            });
        }
        _logger.LogInformation("GetLedger stream | TenantId={TenantId} | Written={Written} | Duration={DurationMs}ms",
            request.TenantId, written, sw.ElapsedMilliseconds);
    }
}
