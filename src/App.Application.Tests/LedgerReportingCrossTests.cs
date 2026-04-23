using Moq;
using Xunit;
using App.Application.Services;
using App.Application.DTOs;
using App.Application.Interfaces;
using App.Domain.Entities;
using App.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using NodaTime;
using App.Application.Tests.Fakes;

namespace App.Application.Tests;

public class LedgerReportingCrossTests
{
    private static TestDbContext CreateDb()
    {
        var opts = new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TestDbContext(opts);
    }

    [Fact]
    public async Task GetLedger_AppliesFilters_Correctly()
    {
        using var db = CreateDb();
        var tenantId = Guid.NewGuid();
        var field1 = Guid.NewGuid();
        var field2 = Guid.NewGuid();
        var category1 = Guid.NewGuid();

        // Setup Data
        var event1 = new LivestockEvent { Id = Guid.NewGuid(), TenantId = tenantId, EventDate = Instant.FromUtc(2026, 1, 1, 10, 0), FieldId = field1, CostCenterCode = "CC1", Status = LivestockEventStatus.Draft, EventTemplateId = Guid.NewGuid() };
        var event2 = new LivestockEvent { Id = Guid.NewGuid(), TenantId = tenantId, EventDate = Instant.FromUtc(2026, 1, 15, 10, 0), FieldId = field2, CostCenterCode = "CC2", Status = LivestockEventStatus.Draft, EventTemplateId = Guid.NewGuid() };
        db.LivestockEvents.AddRange(event1, event2);

        db.AccountingDrafts.AddRange(
            new AccountingDraft { Id = Guid.NewGuid(), TenantId = tenantId, LivestockEventId = event1.Id, AccountCode = "101", FieldId = field1, CategoryId = category1, DebitAmount = 100, Concept = "Test 1", EntryType = "DEBE" },
            new AccountingDraft { Id = Guid.NewGuid(), TenantId = tenantId, LivestockEventId = event2.Id, AccountCode = "201", FieldId = field2, DebitAmount = 200, Concept = "Test 2", EntryType = "DEBE" }
        );
        await db.SaveChangesAsync();

        var reportSvc = new ReportService(db);

        // Test 1: Filter by AccountCode
        var res1 = await reportSvc.GetLedgerAsync(null, null, 0, 10, null, tenantId, "101", null, null);
        Assert.Single(res1);
        Assert.Equal("101", res1.First().AccountCode);

        // Test 2: Filter by FieldId
        var res2 = await reportSvc.GetLedgerAsync(null, null, 0, 10, null, tenantId, null, null, field2);
        Assert.Single(res2);
        Assert.Equal(event2.Id, res2.First().LivestockEventId);

        // Test 3: Filter by Date Range
        var start = Instant.FromUtc(2026, 1, 1, 0, 0);
        var end = Instant.FromUtc(2026, 1, 5, 0, 0);
        var res3 = await reportSvc.GetLedgerAsync(start, end, 0, 10, null, tenantId, null, null, null);
        Assert.Single(res3);
        Assert.Equal(event1.Id, res3.First().LivestockEventId);
    }
}
