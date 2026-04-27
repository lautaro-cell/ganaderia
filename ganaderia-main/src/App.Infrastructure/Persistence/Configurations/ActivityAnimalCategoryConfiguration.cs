using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using App.Domain.Entities;

namespace App.Infrastructure.Persistence.Configurations;

public class ActivityAnimalCategoryConfiguration : IEntityTypeConfiguration<ActivityAnimalCategory>
{
    public void Configure(EntityTypeBuilder<ActivityAnimalCategory> b)
    {
        b.ToTable("ActivityAnimalCategories");

        // PK compuesta: (ActivityId, AnimalCategoryId)
        b.HasKey(e => new { e.ActivityId, e.AnimalCategoryId });

        b.HasIndex(e => e.AnimalCategoryId)
            .HasDatabaseName("IX_ActivityAnimalCategories_CategoryId");

        b.HasOne(e => e.Activity)
            .WithMany()
            .HasForeignKey(e => e.ActivityId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(e => e.AnimalCategory)
            .WithMany()
            .HasForeignKey(e => e.AnimalCategoryId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
