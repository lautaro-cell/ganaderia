using System.Threading.Tasks;
using GestorGanadero.Services.Sync.Contracts;
using Grpc.Core;

namespace GestorGanadero.Client.Sync
{
    public class SyncClientService
    {
        private readonly SyncService.SyncServiceClient _client;

        public SyncClientService(SyncService.SyncServiceClient client)
        {
            _client = client;
        }

        public async Task<AppResult<PendingSyncList>> GetPendingAsync(PendingSyncFilter filter)
        {
            try { return AppResult<PendingSyncList>.SuccessResult(await _client.GetPendingSyncEventsAsync(filter)); }
            catch (RpcException e) { return AppResult<PendingSyncList>.Failure(e.Status.Detail); }
        }

        public async Task<AppResult<SyncResult>> SyncToERPAsync(SyncRequest req)
        {
            try { return AppResult<SyncResult>.SuccessResult(await _client.SyncToERPAsync(req)); }
            catch (RpcException e) { return AppResult<SyncResult>.Failure(e.Status.Detail); }
        }
    }
}
