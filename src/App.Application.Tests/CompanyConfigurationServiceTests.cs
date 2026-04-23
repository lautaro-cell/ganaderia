using Moq;
using Xunit;
using App.Application.Services;
using App.Application.DTOs;
using App.Application.Interfaces;
using App.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using App.Application.Tests.Fakes;
using System.ComponentModel.DataAnnotations;

namespace App.Application.Tests;

public class CompanyConfigurationServiceTests
{
    private static TestDbContext CreateDb()
    {
        var opts = new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TestDbContext(opts);
    }

    [Fact]
    public async Task SaveAsync_ValidNewConfig_SavesAndSyncs()
    {
        using var db = CreateDb();
        var tenantId = Guid.NewGuid();
        db.Tenants.Add(new Tenant { Id = tenantId, Name = "Old Name" });
        await db.SaveChangesAsync();

        var encMock = new Mock<IEncryptionService>();
        encMock.Setup(e => e.Encrypt(It.IsAny<string>())).Returns("encrypted_key");

        var syncMock = new Mock<IErpSyncService>();
        var logger = NullLogger<CompanyConfigurationService>.Instance;

        var svc = new CompanyConfigurationService(db, encMock.Object, syncMock.Object, logger);

        var command = new SaveErpConfigurationCommand
        {
            TenantId = tenantId,
            TenantName = "New Name",
            GestorDatabaseId = 123,
            BaseUrl = "http://api.test",
            ApiKey = "secret_key_123"
        };

        await svc.SaveAsync(command);

        var config = await db.GestorMaxConfigs.FirstOrDefaultAsync(c => c.TenantId == tenantId);
        Assert.NotNull(config);
        Assert.Equal("encrypted_key", config.ApiKeyEncrypted);
        Assert.Equal("_123", config.ApiKeyLast4);
        Assert.Equal("http://api.test", config.BaseUrl);

        var tenant = await db.Tenants.FindAsync(tenantId);
        Assert.Equal("New Name", tenant.Name);

        syncMock.Verify(s => s.SyncCatalogAsync(tenantId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SaveAsync_InvalidKey_ThrowsValidationException()
    {
        using var db = CreateDb();
        var svc = new CompanyConfigurationService(db, Mock.Of<IEncryptionService>(), Mock.Of<IErpSyncService>(), NullLogger<CompanyConfigurationService>.Instance);

        var command = new SaveErpConfigurationCommand
        {
            TenantId = Guid.NewGuid(),
            TenantName = "Test",
            ApiKey = "short" // < 8 chars
        };

        await Assert.ThrowsAsync<ValidationException>(() => svc.SaveAsync(command));
    }
}
