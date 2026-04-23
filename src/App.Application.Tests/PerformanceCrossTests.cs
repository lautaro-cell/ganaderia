using Moq;
using Xunit;
using App.Application.Services;
using App.Application.DTOs;
using App.Application.Interfaces;
using App.Domain.Entities;
using App.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using App.Application.Tests.Fakes;
using NodaTime;

namespace App.Application.Tests;

public class PerformanceCrossTests
{
    private static TestDbContext CreateDb()
    {
        var opts = new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TestDbContext(opts);
    }

    [Fact]
    public async Task GetEventsPaged_ReturnsCorrectSlice_And_TotalCount()
    {
        using var db = CreateDb();
        var tenantId = Guid.NewGuid();
        var tenantProvider = new Mock<ITenantProvider>();
        tenantProvider.Setup(p => p.TenantId).Returns(tenantId);
        var translationSvc = new Mock<ITranslationService>();

        var templateId = Guid.NewGuid();
        db.EventTemplates.Add(new EventTemplate { 
            Id = templateId, Code = "T1", Name = "Test", 
            DebitAccountCode = "1", CreditAccountCode = "2", TenantId = tenantId 
        });

        // Add 25 events
        var baseDate = Instant.FromUtc(2026, 1, 1, 0, 0);
        for (int i = 0; i < 25; i++)
        {
            db.LivestockEvents.Add(new LivestockEvent
            {
                Id = Guid.NewGuid(),
                EventTemplateId = templateId,
                TenantId = tenantId,
                EventDate = baseDate.Plus(Duration.FromDays(i)),
                Status = LivestockEventStatus.Draft,
                CostCenterCode = "C1"
            });
        }
        await db.SaveChangesAsync();

        var service = new LivestockEventService(db, tenantProvider.Object, translationSvc.Object);

        // Page 0, Size 10
        var (items1, total1) = await service.GetEventsPagedAsync(tenantId, null, null, 0, 10);
        Assert.Equal(25, total1);
        Assert.Equal(10, items1.Count);
        // Ordering check (descending)
        Assert.Equal(baseDate.Plus(Duration.FromDays(24)), items1[0].EventDate);

        // Page 2, Size 10 (Last 5)
        var (items2, total2) = await service.GetEventsPagedAsync(tenantId, null, null, 2, 10);
        Assert.Equal(25, total2);
        Assert.Equal(5, items2.Count);
    }
}
