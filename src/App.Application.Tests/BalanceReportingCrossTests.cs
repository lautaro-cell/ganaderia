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

public class BalanceReportingCrossTests
{
    private static TestDbContext CreateDb()
    {
        var opts = new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TestDbContext(opts);
    }

    [Fact]
    public async Task GetBalance_CalculatesMonthlyAndCumulative_Correctly()
    {
        using var db = CreateDb();
        var tenantId = Guid.NewGuid();
        var fieldId = Guid.NewGuid();

        // 1. Setup Data: Entries in Jan and Feb
        var eventJan = new LivestockEvent { Id = Guid.NewGuid(), TenantId = tenantId, EventDate = Instant.FromUtc(2026, 1, 10, 10, 0), FieldId = fieldId, CostCenterCode = "C1", Status = LivestockEventStatus.Validated, EventTemplateId = Guid.NewGuid() };
        var eventFeb = new LivestockEvent { Id = Guid.NewGuid(), TenantId = tenantId, EventDate = Instant.FromUtc(2026, 2, 5, 10, 0), FieldId = fieldId, CostCenterCode = "C2", Status = LivestockEventStatus.Validated, EventTemplateId = Guid.NewGuid() };
        db.LivestockEvents.AddRange(eventJan, eventFeb);

        db.AccountingDrafts.AddRange(
            // Jan: 10 heads
            new AccountingDraft { Id = Guid.NewGuid(), TenantId = tenantId, LivestockEventId = eventJan.Id, AccountCode = "101", FieldId = fieldId, DebitAmount = 1000, HeadCount = 10, Concept = "Jan Entry", EntryType = "DEBE" },
            // Feb: 5 heads
            new AccountingDraft { Id = Guid.NewGuid(), TenantId = tenantId, LivestockEventId = eventFeb.Id, AccountCode = "101", FieldId = fieldId, DebitAmount = 500, HeadCount = 5, Concept = "Feb Entry", EntryType = "DEBE" }
        );
        await db.SaveChangesAsync();

        var reportSvc = new ReportService(db);

        // Test 1: Monthly (Jan only)
        var startJan = Instant.FromUtc(2026, 1, 1, 0, 0);
        var endJan = Instant.FromUtc(2026, 1, 31, 23, 59, 59);
        var resJan = await reportSvc.GetBalanceAsync(null, startJan, endJan, "cliente", tenantId, null);
        
        Assert.Single(resJan);
        Assert.Equal(10, resJan.First().HeadCount);
        Assert.Equal(1000, resJan.First().DebitTotal);

        // Test 2: Cumulative (Jan + Feb)
        var startYear = Instant.FromUtc(2026, 1, 1, 0, 0);
        var endFeb = Instant.FromUtc(2026, 2, 28, 23, 59, 59);
        var resYear = await reportSvc.GetBalanceAsync(null, startYear, endFeb, "cliente", tenantId, null);

        Assert.Single(resYear);
        Assert.Equal(15, resYear.First().HeadCount);
        Assert.Equal(1500, resYear.First().DebitTotal);
    }

    [Fact]
    public async Task GetBalance_DeduplicatesExactDuplicateDrafts()
    {
        using var db = CreateDb();
        var tenantId = Guid.NewGuid();
        var fieldId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();

        var ev = new LivestockEvent
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EventDate = Instant.FromUtc(2026, 3, 10, 10, 0),
            FieldId = fieldId,
            CategoryId = categoryId,
            CostCenterCode = "C1",
            Status = LivestockEventStatus.Validated,
            EventTemplateId = Guid.NewGuid()
        };
        db.LivestockEvents.Add(ev);

        db.AccountingDrafts.AddRange(
            new AccountingDraft
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                LivestockEventId = ev.Id,
                AccountCode = "101",
                FieldId = fieldId,
                CategoryId = categoryId,
                DebitAmount = 1000,
                CreditAmount = 0,
                HeadCount = 10,
                WeightKg = 1000,
                EntryType = "DEBE",
                Concept = "Movimiento"
            },
            new AccountingDraft
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                LivestockEventId = ev.Id,
                AccountCode = "101",
                FieldId = fieldId,
                CategoryId = categoryId,
                DebitAmount = 1000,
                CreditAmount = 0,
                HeadCount = 10,
                WeightKg = 1000,
                EntryType = "DEBE",
                Concept = "Movimiento"
            });
        await db.SaveChangesAsync();

        var reportSvc = new ReportService(db);
        var start = Instant.FromUtc(2026, 3, 1, 0, 0);
        var end = Instant.FromUtc(2026, 3, 31, 23, 59, 59);

        var result = await reportSvc.GetBalanceAsync(fieldId, start, end, "cliente", tenantId, categoryId);
        var row = Assert.Single(result);

        Assert.Equal(10, row.HeadCount);
        Assert.Equal(1000, row.DebitTotal);
        Assert.Equal(1000, row.NetBalance);
    }

    [Fact]
    public async Task GetBalance_GestorView_DoesNotDuplicateWhenCategoryHasMultipleMappings()
    {
        using var db = CreateDb();
        var tenantId = Guid.NewGuid();
        var fieldId = Guid.NewGuid();
        var clientCategoryId = Guid.NewGuid();

        var eventEntity = new LivestockEvent
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EventDate = Instant.FromUtc(2026, 4, 15, 10, 0),
            FieldId = fieldId,
            CategoryId = clientCategoryId,
            CostCenterCode = "C1",
            Status = LivestockEventStatus.Validated,
            EventTemplateId = Guid.NewGuid()
        };
        db.LivestockEvents.Add(eventEntity);

        db.AnimalCategories.AddRange(
            new AnimalCategory
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = "Cliente Cat",
                ExternalId = "CL-1",
                ActivityId = Guid.NewGuid(),
                Type = CategoryType.Client
            },
            new AnimalCategory
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = "Gestor Cat",
                ExternalId = "GS-100",
                ActivityId = Guid.NewGuid(),
                Type = CategoryType.Gestor
            });

        db.CategoryMappings.AddRange(
            new CategoryMapping
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CategoriaClienteId = clientCategoryId,
                CategoriaGestorId = "GS-100"
            },
            new CategoryMapping
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CategoriaClienteId = clientCategoryId,
                CategoriaGestorId = "GS-100"
            });

        db.AccountingDrafts.Add(new AccountingDraft
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            LivestockEventId = eventEntity.Id,
            AccountCode = "101",
            FieldId = fieldId,
            CategoryId = clientCategoryId,
            DebitAmount = 500,
            CreditAmount = 0,
            HeadCount = 5,
            WeightKg = 250,
            EntryType = "DEBE",
            Concept = "Movimiento"
        });
        await db.SaveChangesAsync();

        var reportSvc = new ReportService(db);
        var start = Instant.FromUtc(2026, 4, 1, 0, 0);
        var end = Instant.FromUtc(2026, 4, 30, 23, 59, 59);

        var result = await reportSvc.GetBalanceAsync(fieldId, start, end, "gestor", tenantId, clientCategoryId);
        var row = Assert.Single(result);

        Assert.Equal("Gestor Cat", row.CategoryName);
        Assert.Equal(5, row.HeadCount);
        Assert.Equal(500, row.DebitTotal);
        Assert.Equal(500, row.NetBalance);
    }
}
