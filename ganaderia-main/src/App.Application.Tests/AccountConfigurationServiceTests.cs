using Microsoft.EntityFrameworkCore;
using Xunit;
using App.Application.Services;
using App.Application.DTOs;
using App.Application.Tests.Fakes;
using App.Domain.Enums;
using System.ComponentModel.DataAnnotations;

namespace App.Application.Tests;

public class AccountConfigurationServiceTests
{
    private static TestDbContext CreateDb()
    {
        var opts = new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TestDbContext(opts);
    }

    [Fact]
    public async Task SaveAsync_ValidCommand_SavesConfiguration()
    {
        using var db = CreateDb();
        var svc = new AccountConfigurationService(db);
        var tenantId = Guid.NewGuid();

        var command = new SaveAccountConfigurationCommand
        {
            TenantId = tenantId,
            EventType = EventType.Compra,
            DebitAccountCode = "DEBE-01",
            CreditAccountCode = "HABER-01",
            Description = "Test Config"
        };

        var id = await svc.SaveAsync(command);

        var saved = await db.AccountConfigurations.FindAsync(id);
        Assert.NotNull(saved);
        Assert.Equal(tenantId, saved.TenantId);
        Assert.Equal(EventType.Compra, saved.EventType);
        Assert.Equal("DEBE-01", saved.DebitAccountCode);
        Assert.Equal("HABER-01", saved.CreditAccountCode);
    }

    [Fact]
    public async Task SaveAsync_SameAccounts_ThrowsValidationException()
    {
        using var db = CreateDb();
        var svc = new AccountConfigurationService(db);

        var command = new SaveAccountConfigurationCommand
        {
            TenantId = Guid.NewGuid(),
            EventType = EventType.Compra,
            DebitAccountCode = "SAME-01",
            CreditAccountCode = "SAME-01"
        };

        await Assert.ThrowsAsync<ValidationException>(() => svc.SaveAsync(command));
    }

    [Fact]
    public async Task SaveAsync_MissingRequiredFields_ThrowsValidationException()
    {
        using var db = CreateDb();
        var svc = new AccountConfigurationService(db);

        var command = new SaveAccountConfigurationCommand
        {
            // Missing TenantId, DebitAccountCode, etc.
        };

        await Assert.ThrowsAsync<ValidationException>(() => svc.SaveAsync(command));
    }

    [Fact]
    public async Task GetAccountCodesAsync_NoConfig_UsesDefaultOrThrows()
    {
        using var db = CreateDb();
        var svc = new AccountConfigurationService(db);
        var tenantId = Guid.NewGuid();

        // 1. No config, no default -> throws
        await Assert.ThrowsAsync<App.Domain.Exceptions.AccountConfigurationException>(
            () => svc.GetAccountCodesAsync(tenantId, EventType.Compra));

        // 2. No config, with default -> returns default
        var (debit, credit) = await svc.GetAccountCodesAsync(tenantId, EventType.Compra, "DEF-D", "DEF-C");
        Assert.Equal("DEF-D", debit);
        Assert.Equal("DEF-C", credit);
    }
}
