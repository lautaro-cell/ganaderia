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

public class LivestockEventCrossTests
{
    private static TestDbContext CreateDb()
    {
        var opts = new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TestDbContext(opts);
    }

    [Fact]
    public async Task CreateEvent_TriggersTranslation_AndGeneratesDrafts()
    {
        using var db = CreateDb();
        var tenantId = Guid.NewGuid();
        var tenantProvider = new Mock<ITenantProvider>();
        tenantProvider.Setup(p => p.TenantId).Returns(tenantId);

        // 1. Setup Template
        var template = new EventTemplate
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = "COMPRA",
            Name = "Compra de Hacienda",
            EventType = EventType.Compra,
            DebitAccountCode = "ACTIVO-01",
            CreditAccountCode = "PASIVO-01",
            IsActive = true
        };
        db.EventTemplates.Add(template);

        var field = new Field { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Campo Test" };
        db.Fields.Add(field);
        await db.SaveChangesAsync();

        // 2. Setup Services
        var accountConfigSvc = new FakeAccountConfigurationService(new Dictionary<EventType, (string, string)>());
        var translationSvc = new TranslationService(db, accountConfigSvc, NullLogger<TranslationService>.Instance);
        var eventSvc = new LivestockEventService(db, tenantProvider.Object, translationSvc);

        // 3. Create Event
        var request = new CreateLivestockEventRequest(
            template.Id,
            field.Id.ToString(),
            10,
            100m,
            1000m,
            SystemClock.Instance.GetCurrentInstant()
        );

        var eventId = await eventSvc.CreateEventAsync(request);

        // 4. Verify Event
        var ev = await db.LivestockEvents.FindAsync(eventId);
        Assert.NotNull(ev);
        Assert.Equal(LivestockEventStatus.Validated, ev.Status);

        // 5. Verify Drafts (Cross-check with TranslationService)
        var drafts = await db.AccountingDrafts.Where(d => d.LivestockEventId == eventId).ToListAsync();
        Assert.Equal(2, drafts.Count);
        
        var debe = drafts.Single(d => d.DebitAmount > 0);
        var haber = drafts.Single(d => d.CreditAmount > 0);

        Assert.Equal("ACTIVO-01", debe.AccountCode);
        Assert.Equal("PASIVO-01", haber.AccountCode);
        Assert.Equal(1000m, debe.DebitAmount);
        Assert.Equal(1000m, haber.CreditAmount);
    }
}
