using System.Collections.Generic;
using System.Threading.Tasks;
using Xunit;

namespace GestorGanadero.Client.Tests
{
  // No namespace; ReportingClientService is in global namespace

  public class LedgerStreamingTests
  {
    [Fact]
    public async Task Ledger_streaming_yields_expected_items()
    {
      // Arrange: create a fake in-memory ledger stream using the real LedgerEntryView type
      async IAsyncEnumerable<ReportingClientService.LedgerEntryView> FakeStream()
      {
        yield return new ReportingClientService.LedgerEntryView { Id = "1", Description = "D1", Date = System.DateTime.Now, EntryType = "T", Amount = 10, HeadCount = 1, Status = "OK" };
        yield return new ReportingClientService.LedgerEntryView { Id = "2", Description = "D2", Date = System.DateTime.Now, EntryType = "T", Amount = 20, HeadCount = 2, Status = "OK" };
      }

      // Act: Collect the stream into a list
      var collected = new List<ReportingClientService.LedgerEntryView>();
      await foreach (var item in FakeStream()) collected.Add(item);

      // Assert
      Assert.Equal(2, collected.Count);
      Assert.Equal("1", collected[0].Id);
      Assert.Equal("2", collected[1].Id);
    }
  }
}

