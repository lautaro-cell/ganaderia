using System.Threading.Tasks;
using System.Linq;
using GestorGanadero.Services.Operations.Contracts;
using GestorGanadero.Services.Common.Contracts;
using Grpc.Core;

namespace GestorGanadero.Client.Operations
{
    public class OperationsClientService
    {
        private readonly OperationsService.OperationsServiceClient _client;

        public OperationsClientService(OperationsService.OperationsServiceClient client)
        {
            _client = client;
        }

        public async Task<AppResult<EventTemplateList>> GetTemplatesAsync(GetTemplatesRequest req)
        {
            try { return AppResult<EventTemplateList>.SuccessResult(await _client.GetEventTemplatesAsync(req)); }
            catch (RpcException e) { return AppResult<EventTemplateList>.Failure(e.Status.Detail); }
        }

        public async Task<AppResult<ActionResponse>> RegisterEventAsync(RegisterEventRequest req)
        {
            try { return AppResult<ActionResponse>.SuccessResult(await _client.RegisterEventAsync(req)); }
            catch (RpcException e) { return AppResult<ActionResponse>.Failure(e.Status.Detail); }
        }

        public async Task<AppResult<EventList>> GetEventsAsync(GetEventsRequest req)
        {
            try { return AppResult<EventList>.SuccessResult(await _client.GetEventsAsync(req)); }
            catch (RpcException e) { return AppResult<EventList>.Failure(e.Status.Detail); }
        }
    }
}
