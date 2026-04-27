using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using GestorGanadero.Services.Catalog.Contracts;
using GestorGanadero.Services.Common.Contracts;

namespace GestorGanadero.Client.Catalog;

public class CatalogCacheService
{
    private readonly CatalogClientService _inner;
    private readonly Dictionary<string, (DateTimeOffset Expiry, object Data)> _cache = new();
    private static readonly TimeSpan _ttl = TimeSpan.FromMinutes(5);

    public CatalogCacheService(CatalogClientService inner) => _inner = inner;

    public Task<AppResult<FieldList>> GetFieldsAsync(GetCatalogRequest req) =>
        GetOrFetch<FieldList>($"fields:{req.TenantId}", () => _inner.GetFieldsAsync(req));

    public Task<AppResult<ActivityList>> GetActivitiesAsync(GetCatalogRequest req) =>
        GetOrFetch<ActivityList>($"activities:{req.TenantId}", () => _inner.GetActivitiesAsync(req));

    public Task<AppResult<AnimalCategoryList>> GetAnimalCategoriesAsync(GetCatalogRequest req) =>
        GetOrFetch<AnimalCategoryList>($"categories:{req.TenantId}", () => _inner.GetAnimalCategoriesAsync(req));

    public Task<AppResult<AccountList>> GetAccountsAsync(GetCatalogRequest req) =>
        GetOrFetch<AccountList>($"accounts:{req.TenantId}", () => _inner.GetAccountsAsync(req));

    public void InvalidateAll() => _cache.Clear();

    public void InvalidateTenant(string tenantId)
    {
        _cache.Remove($"fields:{tenantId}");
        _cache.Remove($"activities:{tenantId}");
        _cache.Remove($"categories:{tenantId}");
        _cache.Remove($"accounts:{tenantId}");
    }

    private async Task<AppResult<T>> GetOrFetch<T>(string key, Func<Task<AppResult<T>>> fetch)
    {
        if (_cache.TryGetValue(key, out var entry) && entry.Expiry > DateTimeOffset.UtcNow)
            return (AppResult<T>)entry.Data;

        var result = await fetch();
        if (result.Success)
            _cache[key] = (DateTimeOffset.UtcNow.Add(_ttl), result);
        return result;
    }
}
