using Grpc.Core;
using Google.Protobuf.WellKnownTypes;
using GestorGanadero.Server.Application.Interfaces;
using GestorGanadero.Services.Reporting.Contracts;
using Microsoft.Extensions.Logging;
using System.Linq;
using System.Threading.Tasks;
using System;

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
            request.Date?.ToDateTime(),
            request.CategoryView);

        var response = new BalanceReport { ReportDate = request.Date ?? Timestamp.FromDateTime(DateTime.UtcNow) };
        response.Items.AddRange(balance.Select(b => new BalanceItem
        {
            FieldName = b.FieldName,
            CategoryName = b.CategoryName,
            HeadCount = b.HeadCount,
            TotalWeight = (double)b.TotalWeight,
            ActivityName = b.ActivityName
        }));
        return response;
    }

    public override async Task GetLedger(LedgerFilter request, IServerStreamWriter<LedgerEntry> responseStream, ServerCallContext context)
    {
        await responseStream.WriteAsync(new LedgerEntry { Id = Guid.NewGuid().ToString(), Description = "Mock Ledger Entry", Amount = 100 });
    }
}
