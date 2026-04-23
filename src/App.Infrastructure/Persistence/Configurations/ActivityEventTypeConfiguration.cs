using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using App.Domain.Entities;

namespace App.Infrastructure.Persistence.Configurations;

public class ActivityEventTypeConfiguration : IEntityTypeConfiguration<ActivityEventType>
{
    public void Configure(EntityTypeBuilder<ActivityEventType> b)
    {
        b.ToTable("ActivityEventTypes");

        // PK compuesta: (ActivityId, EventType)
        b.HasKey(e => new { e.ActivityId, e.EventType });

        b.HasIndex(e => e.EventType)
            .HasDatabaseName("IX_ActivityEventTypes_EventType");

        b.HasOne(e => e.Activity)
            .WithMany()
            .HasForeignKey(e => e.ActivityId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
