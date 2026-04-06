using System.Threading.Tasks;
using System.Linq;
using GestorGanadero.Services.Identity.Contracts;
using GestorGanadero.Services.Common.Contracts;
using Google.Protobuf.WellKnownTypes;
using Grpc.Core;

namespace GestorGanadero.Client.Identity
{
    public class IdentityClientService
    {
        private readonly IdentityService.IdentityServiceClient _client;
        
        public IdentityClientService(IdentityService.IdentityServiceClient client)
        {
            _client = client;
        }

        public async Task<AppResult<UserProfile>> GetMyProfileAsync()
        {
            try { return AppResult<UserProfile>.SuccessResult(await _client.GetMyProfileAsync(new Empty())); }
            catch (RpcException e) { return AppResult<UserProfile>.Failure(e.Status.Detail); }
        }

        public async Task<AppResult<TenantList>> GetAvailableTenantsAsync()
        {
            try { return AppResult<TenantList>.SuccessResult(await _client.GetAvailableTenantsAsync(new Empty())); }
            catch (RpcException e) { return AppResult<TenantList>.Failure(e.Status.Detail); }
        }

        public async Task<AppResult<UserList>> GetUsersAsync()
        {
            try { return AppResult<UserList>.SuccessResult(await _client.GetUsersAsync(new Empty())); }
            catch (RpcException e) { return AppResult<UserList>.Failure(e.Status.Detail); }
        }

        public async Task<AppResult<ActionResponse>> InviteUserAsync(InviteUserRequest req)
        {
            try { return AppResult<ActionResponse>.SuccessResult(await _client.InviteUserAsync(req)); }
            catch (RpcException e) { return AppResult<ActionResponse>.Failure(e.Status.Detail); }
        }

        public async Task<AppResult<ActionResponse>> DeleteUserAsync(string id, string tenantId)
        {
            try { return AppResult<ActionResponse>.SuccessResult(await _client.DeleteUserAsync(new DeleteEntityRequest { Id = id, TenantId = tenantId })); }
            catch (RpcException e) { return AppResult<ActionResponse>.Failure(e.Status.Detail); }
        }
    }
}
