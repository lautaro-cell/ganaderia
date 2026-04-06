using System.Collections.Generic;
using System.Linq;
using Xunit;

namespace GestorGanadero.Client.Tests
{
  public class BalanceTests
  {
    [Fact]
    public void Balance_grouping_by_field_activity_category()
    {
      // Arrange: create balance items similar to ReportingClientService.BalanceItemView
      var items = new List<ReportingClientService.BalanceItemView>
      {
        new ReportingClientService.BalanceItemView { FieldName = "FieldA", ActivityName = "Act1", CategoryName = "Cat1", HeadCount = 3, TotalWeight = 30 },
        new ReportingClientService.BalanceItemView { FieldName = "FieldA", ActivityName = "Act1", CategoryName = "Cat2", HeadCount = 2, TotalWeight = 20 },
        new ReportingClientService.BalanceItemView { FieldName = "FieldB", ActivityName = "Act2", CategoryName = "Cat3", HeadCount = 5, TotalWeight = 50 }
      };

      // Act: group by FieldName, then count groups and items per group
      var groups = items.GroupBy(x => x.FieldName).ToList();

      // Assert
      Assert.Equal(2, groups.Count);
      Assert.Equal(2, groups[0].ToList().Count); // FieldA has 2 items
      Assert.Single(groups[1]); // FieldB has 1 item
    }
  }
}
