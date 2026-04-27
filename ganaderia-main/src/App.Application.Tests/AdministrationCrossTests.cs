using Moq;
using Xunit;
using App.Application.Services;
using App.Application.DTOs;
using App.Application.Interfaces;
using App.Domain.Entities;
using App.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using App.Application.Tests.Fakes;

namespace App.Application.Tests;

public class AdministrationCrossTests
{
    private static TestDbContext CreateDb()
    {
        var opts = new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TestDbContext(opts);
    }

    [Fact]
    public async Task CreateField_PersistsActivities_Correctly()
    {
        using var db = CreateDb();
        var tenantId = Guid.NewGuid();
        var tenantProvider = new Mock<ITenantProvider>();
        tenantProvider.Setup(p => p.TenantId).Returns(tenantId);

        var activityId = Guid.NewGuid();
        db.Activities.Add(new Activity { Id = activityId, Name = "Cria" });
        await db.SaveChangesAsync();

        var catalogSvc = new CatalogService(db, tenantProvider.Object);

        // 1. Create Field with Activity
        var dto = new FieldDto(Guid.Empty, "Campo Test", "", true, tenantId, "Legal", 100, 0, 0, new List<Guid> { activityId });
        var fieldId = await catalogSvc.CreateFieldAsync(dto);

        // 2. Verify Relationship
        var field = await db.Fields.Include(f => f.FieldActivities).FirstOrDefaultAsync(f => f.Id == fieldId);
        Assert.NotNull(field);
        Assert.Single(field.FieldActivities);
        Assert.Equal(activityId, field.FieldActivities.First().ActivityId);
    }

    [Fact]
    public async Task UpdateActivity_SyncsCategoriesAndEventTypes()
    {
        using var db = CreateDb();
        var tenantId = Guid.NewGuid();
        var tenantProvider = new Mock<ITenantProvider>();
        tenantProvider.Setup(p => p.TenantId).Returns(tenantId);

        var activity = new Activity { Id = Guid.NewGuid(), Name = "Cria", TenantId = tenantId };
        db.Activities.Add(activity);
        await db.SaveChangesAsync();

        var catId = Guid.NewGuid();
        var etId = Guid.NewGuid();
        db.AnimalCategories.Add(new AnimalCategory { Id = catId, Name = "Vaca", TenantId = tenantId });
        db.EventTemplates.Add(new EventTemplate { Id = etId, Code = "C1", Name = "Compra", TenantId = tenantId, DebitAccountCode = "101", CreditAccountCode = "201" });
        await db.SaveChangesAsync();

        var catalogSvc = new CatalogService(db, tenantProvider.Object);

        // 1. Update Activity with relations
        var dto = new ActivityDto(activity.Id, "Cria Updated", false, tenantId, "Desc", new List<Guid> { catId }, new List<Guid> { etId });
        await catalogSvc.UpdateActivityAsync(dto);

        // 2. Verify
        var act = await db.Activities
            .Include(a => a.ActivityAnimalCategories)
            .FirstAsync(a => a.Id == activity.Id);

        Assert.Single(act.ActivityAnimalCategories);
        Assert.Equal(catId, act.ActivityAnimalCategories.First().AnimalCategoryId);
        
        var eta = await db.EventTemplateActivities.AnyAsync(e => e.ActivityId == activity.Id && e.EventTemplateId == etId);
        Assert.True(eta);
    }
}
