using Microsoft.EntityFrameworkCore;
using App.Domain.Entities;

namespace App.Application.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Tenant> Tenants { get; }
    DbSet<User> Users { get; }
    DbSet<ExternalCatalog> ExternalCatalogs { get; }
    DbSet<EventTemplate> EventTemplates { get; }
    DbSet<LivestockEvent> LivestockEvents { get; }
    DbSet<AccountingDraft> AccountingDrafts { get; }
    DbSet<Field> Fields { get; }
    DbSet<Activity> Activities { get; }
    DbSet<AnimalCategory> AnimalCategories { get; }
    DbSet<CategoryMapping> CategoryMappings { get; }
    DbSet<Account> Accounts { get; }
    DbSet<PlanCuenta> PlanesCuenta { get; }
    DbSet<GestorMaxConfig> GestorMaxConfigs { get; }
    DbSet<ErpConcept> ErpConcepts { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
