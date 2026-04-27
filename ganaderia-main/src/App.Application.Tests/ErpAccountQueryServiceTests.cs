using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using App.Application.Services;
using App.Application.Interfaces;
using App.Application.Tests.Fakes;
using App.Domain.Entities;

namespace App.Application.Tests;

public class ErpAccountQueryServiceTests
{
    private class FakeErpProvider : IERPProvider
    {
        public string JsonToReturn { get; set; } = "[]";
        public Task<JsonDocument> GetAccountsAsync(Guid tenantId) => Task.FromResult(JsonDocument.Parse(JsonToReturn));
        public Task<JsonDocument> GetCostCentersAsync(Guid tenantId) => throw new NotImplementedException();
        public Task<JsonDocument> GetAnimalCategoriesAsync(Guid tenantId) => throw new NotImplementedException();
    }

    private static TestDbContext CreateDb()
    {
        var opts = new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TestDbContext(opts);
    }

    [Fact]
    public async Task GetAccountsForSelectorAsync_ValidTenant_ReturnsParsedAccounts()
    {
        using var db = CreateDb();
        var tenantId = Guid.NewGuid();
        db.GestorMaxConfigs.Add(new GestorMaxConfig { TenantId = tenantId, IsEnabled = true, BaseUrl = "http://test", ApiKeyEncrypted = "key" });
        await db.SaveChangesAsync();

        var erpProvider = new FakeErpProvider
        {
            JsonToReturn = "[{\"Code\":\"1.1.01\",\"Name\":\"Caja\",\"Type\":\"Activo\"},{\"Code\":\"1.1.02\",\"Name\":\"Bancos\",\"Type\":\"Activo\"}]"
        };
        var svc = new ErpAccountQueryService(db, erpProvider, NullLogger<ErpAccountQueryService>.Instance);

        var result = (await svc.GetAccountsForSelectorAsync(tenantId)).ToList();

        Assert.Equal(2, result.Count);
        Assert.Equal("1.1.01", result[0].Code);
        Assert.Equal("Caja", result[0].Name);
        Assert.Equal("1.1.02", result[1].Code);
    }

    [Fact]
    public async Task GetAccountsForSelectorAsync_NoConfig_ThrowsInvalidOperationException()
    {
        using var db = CreateDb();
        var tenantId = Guid.NewGuid();
        // No config added

        var svc = new ErpAccountQueryService(db, new FakeErpProvider(), NullLogger<ErpAccountQueryService>.Instance);

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.GetAccountsForSelectorAsync(tenantId));
    }
}
