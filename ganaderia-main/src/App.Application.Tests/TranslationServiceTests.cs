using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using NodaTime;
using Xunit;
using App.Application.Services;
using App.Application.Tests.Fakes;
using App.Domain.Entities;
using App.Domain.Enums;
using App.Domain.Exceptions;

namespace App.Application.Tests;

public class TranslationServiceTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    private static TestDbContext CreateDb()
    {
        var opts = new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TestDbContext(opts);
    }

    private static TranslationService CreateService(
        TestDbContext db,
        Dictionary<EventType, (string Debit, string Credit)> configs)
    {
        var accountSvc = new FakeAccountConfigurationService(configs);
        var logger = NullLogger<TranslationService>.Instance;
        return new TranslationService(db, accountSvc, logger);
    }

    private static EventTemplate BuildTemplate(EventType tipo, string debit, string credit) =>
        new EventTemplate
        {
            TenantId = TenantId,
            Code = tipo.ToString(),
            Name = tipo.ToString(),
            EventType = tipo,
            DebitAccountCode = debit,
            CreditAccountCode = credit
        };

    private static LivestockEvent BuildEvent(EventTemplate template, decimal amount, int heads, decimal kg) =>
        new LivestockEvent
        {
            TenantId = TenantId,
            EventTemplateId = template.Id,
            EventTemplate = template,
            CostCenterCode = "CAMPO-01",
            HeadCount = heads,
            EstimatedWeightKg = kg,
            TotalAmount = amount,
            EventDate = SystemClock.Instance.GetCurrentInstant(),
            Status = LivestockEventStatus.Draft
        };

    // ── Caso 1: Traslado entre campos ─────────────────────────────────────

    [Fact]
    public async Task Traslado_GeneraDosAsientos_ConCuentasDeConfiguracion()
    {
        using var db = CreateDb();
        var template = BuildTemplate(EventType.Traslado, "ACTIVO-01", "ACTIVO-02");
        var originField = Guid.NewGuid();
        var destField = Guid.NewGuid();

        var ev = BuildEvent(template, 500m, 10, 3000m);
        ev.FieldId = originField;
        ev.DestinationFieldId = destField;

        db.EventTemplates.Add(template);
        db.LivestockEvents.Add(ev);
        await db.SaveChangesAsync();

        var configs = new Dictionary<EventType, (string, string)>
        {
            [EventType.Traslado] = ("CAMPO-DEST", "CAMPO-ORIG")
        };
        var svc = CreateService(db, configs);

        var drafts = (await svc.TranslateEventToDraftAsync(ev.Id)).ToList();

        Assert.Equal(2, drafts.Count);

        var debe = drafts.Single(d => d.DebitAmount > 0);
        var haber = drafts.Single(d => d.CreditAmount > 0);

        Assert.Equal("CAMPO-DEST", debe.AccountCode);
        Assert.Equal("CAMPO-ORIG", haber.AccountCode);
        Assert.Equal(500m, debe.DebitAmount);
        Assert.Equal(500m, haber.CreditAmount);

        // referencias correctas
        var dbDrafts = db.AccountingDrafts.ToList();
        Assert.Equal(destField, dbDrafts.Single(d => d.DebitAmount > 0).FieldId);
        Assert.Equal(originField, dbDrafts.Single(d => d.CreditAmount > 0).FieldId);

        // balance
        Assert.Equal(drafts.Sum(d => d.DebitAmount), drafts.Sum(d => d.CreditAmount));
    }

    // ── Caso 2: Cambio de actividad ──────────────────────────────────────

    [Fact]
    public async Task CambioActividad_GeneraDosAsientos_ConReferenciasDeActividad()
    {
        using var db = CreateDb();
        var template = BuildTemplate(EventType.CambioActividad, "ACT-DEST-01", "ACT-ORIG-01");
        var originAct = Guid.NewGuid();
        var destAct = Guid.NewGuid();

        var ev = BuildEvent(template, 300m, 5, 1500m);
        ev.OriginActivityId = originAct;
        ev.DestinationActivityId = destAct;

        db.EventTemplates.Add(template);
        db.LivestockEvents.Add(ev);
        await db.SaveChangesAsync();

        var configs = new Dictionary<EventType, (string, string)>
        {
            [EventType.CambioActividad] = ("ACT-DEST-CFG", "ACT-ORIG-CFG")
        };
        var svc = CreateService(db, configs);

        var drafts = (await svc.TranslateEventToDraftAsync(ev.Id)).ToList();

        Assert.Equal(2, drafts.Count);

        var debe = drafts.Single(d => d.DebitAmount > 0);
        var haber = drafts.Single(d => d.CreditAmount > 0);

        Assert.Equal("ACT-DEST-CFG", debe.AccountCode);
        Assert.Equal("ACT-ORIG-CFG", haber.AccountCode);
        Assert.Equal(300m, debe.DebitAmount);
        Assert.Equal(300m, haber.CreditAmount);

        var dbDrafts = db.AccountingDrafts.ToList();
        Assert.Equal(destAct, dbDrafts.Single(d => d.DebitAmount > 0).ActivityId);
        Assert.Equal(originAct, dbDrafts.Single(d => d.CreditAmount > 0).ActivityId);

        Assert.Equal(drafts.Sum(d => d.DebitAmount), drafts.Sum(d => d.CreditAmount));
    }

    // ── Caso 3: Ajuste de kg positivo ────────────────────────────────────

    [Fact]
    public async Task AjusteKg_Positivo_DebeEnCuentaConfiguradaDebit()
    {
        using var db = CreateDb();
        var template = BuildTemplate(EventType.AjusteKg, "PLANTILLA-D", "PLANTILLA-H");
        var ev = BuildEvent(template, 0m, 0, 200m);

        db.EventTemplates.Add(template);
        db.LivestockEvents.Add(ev);
        await db.SaveChangesAsync();

        var configs = new Dictionary<EventType, (string, string)>
        {
            [EventType.AjusteKg] = ("ACTIVO-KG", "RESULTADO-KG")
        };
        var svc = CreateService(db, configs);

        var drafts = (await svc.TranslateEventToDraftAsync(ev.Id)).ToList();

        Assert.Equal(2, drafts.Count);

        var debe = drafts.Single(d => d.DebitAmount > 0);
        var haber = drafts.Single(d => d.CreditAmount > 0);

        Assert.Equal("ACTIVO-KG", debe.AccountCode);
        Assert.Equal("RESULTADO-KG", haber.AccountCode);
        Assert.Equal(200m, debe.DebitAmount);
        Assert.Equal(200m, haber.CreditAmount);
        Assert.Equal(drafts.Sum(d => d.DebitAmount), drafts.Sum(d => d.CreditAmount));
    }

    // ── Caso 4: Ajuste de kg negativo ────────────────────────────────────

    [Fact]
    public async Task AjusteKg_Negativo_InvierteLasCuentas()
    {
        using var db = CreateDb();
        var template = BuildTemplate(EventType.AjusteKg, "PLANTILLA-D", "PLANTILLA-H");
        var ev = BuildEvent(template, 0m, 0, -150m);

        db.EventTemplates.Add(template);
        db.LivestockEvents.Add(ev);
        await db.SaveChangesAsync();

        var configs = new Dictionary<EventType, (string, string)>
        {
            [EventType.AjusteKg] = ("ACTIVO-KG", "RESULTADO-KG")
        };
        var svc = CreateService(db, configs);

        var drafts = (await svc.TranslateEventToDraftAsync(ev.Id)).ToList();

        Assert.Equal(2, drafts.Count);

        var debe = drafts.Single(d => d.DebitAmount > 0);
        var haber = drafts.Single(d => d.CreditAmount > 0);

        // Para ajuste negativo las cuentas se invierten
        Assert.Equal("RESULTADO-KG", debe.AccountCode);
        Assert.Equal("ACTIVO-KG", haber.AccountCode);
        Assert.Equal(150m, debe.DebitAmount);
        Assert.Equal(150m, haber.CreditAmount);
        Assert.Equal(drafts.Sum(d => d.DebitAmount), drafts.Sum(d => d.CreditAmount));
    }

    // ── Validación: sin configuración de cuentas lanza excepción ─────────

    [Fact]
    public async Task AjusteKg_SinConfiguracion_LanzaAccountConfigurationException()
    {
        using var db = CreateDb();
        var template = BuildTemplate(EventType.AjusteKg, "PLT-D", "PLT-H");
        var ev = BuildEvent(template, 0m, 0, 100m);

        db.EventTemplates.Add(template);
        db.LivestockEvents.Add(ev);
        await db.SaveChangesAsync();

        // Sin config para AjusteKg
        var configs = new Dictionary<EventType, (string, string)>();
        var svc = CreateService(db, configs);

        await Assert.ThrowsAsync<AccountConfigurationException>(
            () => svc.TranslateEventToDraftAsync(ev.Id));
    }

    // ── Validación: evento no encontrado ─────────────────────────────────

    [Fact]
    public async Task EventoInexistente_LanzaInvalidOperationException()
    {
        using var db = CreateDb();
        var svc = CreateService(db, new Dictionary<EventType, (string, string)>());

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.TranslateEventToDraftAsync(Guid.NewGuid()));
    }
}
