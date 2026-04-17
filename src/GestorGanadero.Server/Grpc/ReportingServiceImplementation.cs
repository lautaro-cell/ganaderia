using Grpc.Core;
using Google.Protobuf.WellKnownTypes;
using App.Application.Interfaces;
using GestorGanadero.Services.Reporting.Contracts;
using Microsoft.Extensions.Logging;
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
        var balance = await _reportService.GetBalanceAsync(
            string.IsNullOrEmpty(request.FieldId) ? null : Guid.Parse(request.FieldId),
            request.Date == null ? (Instant?)null : Instant.FromDateTimeUtc(request.Date.ToDateTime()),
            request.CategoryView);

        var response = new BalanceReport { ReportDate = request.Date ?? Timestamp.FromDateTime(DateTime.UtcNow) };
        response.Items.AddRange(balance.Select(b => new BalanceItem
        {
            FieldName = b.FieldName ?? "",
            CategoryName = b.CategoryName ?? "",
            HeadCount = b.HeadCount,
            TotalWeight = (double)b.TotalWeight,
            ActivityName = b.ActivityName ?? "",
            AccountCode = b.AccountCode ?? "",
            DebitTotal = (double)b.DebitTotal,
            CreditTotal = (double)b.CreditTotal,
            NetBalance = (double)b.NetBalance
        }));
        return response;
    }

    public override async Task GetLedger(LedgerFilter request, IServerStreamWriter<LedgerEntry> responseStream, ServerCallContext context)
    {
        var tenantId = string.IsNullOrEmpty(request.TenantId) ? Guid.Empty : Guid.Parse(request.TenantId);
        var entries = await _reportService.GetLedgerAsync(
            request.StartDate == null ? (Instant?)null : Instant.FromDateTimeUtc(request.StartDate.ToDateTime()),
            request.EndDate == null ? (Instant?)null : Instant.FromDateTimeUtc(request.EndDate.ToDateTime()),
            request.PageIndex,
            request.PageSize,
            request.SearchTerm,
            tenantId);

        foreach (var entry in entries)
        {
            if (context.CancellationToken.IsCancellationRequested)
                break;

            await responseStream.WriteAsync(new LedgerEntry
            {
                Id = entry.Id.ToString(),
                Date = Timestamp.FromDateTimeOffset(entry.Date.ToDateTimeOffset()),
                Description = entry.Description ?? "",
                Amount = (double)entry.Amount,
                AccountCode = entry.AccountCode ?? "",
                Status = entry.Status,
                EntryType = entry.EntryType,
                HeadCount = entry.HeadCount,
                WeightKg = entry.WeightKg.ToString()
            });
        }
    }
}

