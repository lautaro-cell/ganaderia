using System.Collections.Generic;
using System.Threading.Tasks;
using GestorGanadero.Services.Reporting.Contracts;
using Grpc.Core;

namespace GestorGanadero.Client.Reporting
{
    public class ReportingClientService
    {
        private readonly ReportingService.ReportingServiceClient _client;

        public ReportingClientService(ReportingService.ReportingServiceClient client)
        {
            _client = client;
        }

        public async IAsyncEnumerable<LedgerEntry> GetLedgerAsync(LedgerFilter filter)
        {
            using var call = _client.GetLedger(filter);
            await foreach (var item in call.ResponseStream.ReadAllAsync())
            {
                yield return item;
            }
        }

        public async Task<AppResult<BalanceReport>> GetBalanceAsync(GetBalanceRequest req)
        {
            try { return AppResult<BalanceReport>.SuccessResult(await _client.GetBalanceAsync(req)); }
            catch (RpcException e) { return AppResult<BalanceReport>.Failure(e.Status.Detail); }
        }
    }
}
