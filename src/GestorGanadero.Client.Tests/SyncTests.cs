using System.Collections.Generic;
using System.Threading.Tasks;
using Xunit;

namespace GestorGanadero.Client.Tests
{
  public class SyncTests
  {
    [Fact]
    public async Task Pending_and_sync_flow_mock()
    {
      // Arrange: instantiate the SyncClientServiceImpl with null client (it's not used in mocked methods)
      var client = new SyncClientServiceImpl(null);

      // Act: call GetPendingAsync and SyncSelectedAsync with two IDs
      var pending = await client.GetPendingAsync();
      Assert.True(pending.Success);
      Assert.NotNull(pending.Data);
      var ids = new List<string> { pending.Data[0].Id, pending.Data[1].Id };
      var sync = await client.SyncSelectedAsync(ids);
      Assert.True(sync.Success);
      Assert.Equal(2, sync.Data.Count);
    }
  }
}
