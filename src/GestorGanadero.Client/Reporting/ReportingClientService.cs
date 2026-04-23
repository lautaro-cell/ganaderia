using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Threading;
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

        public async IAsyncEnumerable<LedgerEntry> GetLedgerAsync(
            LedgerFilter filter,
            [EnumeratorCancellation] CancellationToken ct = default)
        {
            const int maxAttempts = 3;
            for (int attempt = 1; attempt <= maxAttempts; attempt++)
            {
                var buffer = new System.Collections.Generic.List<LedgerEntry>();
                bool shouldRetry = false;
                bool stop = false;

                try
                {
                    using var call = _client.GetLedger(filter, cancellationToken: ct);
                    await foreach (var item in call.ResponseStream.ReadAllAsync(ct))
                        buffer.Add(item);
                }
                catch (OperationCanceledException) { stop = true; }
                catch (RpcException) when (!buffer.Any() && attempt < maxAttempts)
                {
                    shouldRetry = true;
                }

                foreach (var item in buffer) yield return item;

                if (stop || !shouldRetry) yield break;

                bool delayFailed = false;
                try { await Task.Delay(TimeSpan.FromSeconds(Math.Pow(2, attempt - 1)), ct); }
                catch (OperationCanceledException) { delayFailed = true; }
                if (delayFailed) yield break;
            }
        }

        public async Task<AppResult<BalanceReport>> GetBalanceAsync(GetBalanceRequest req)
        {
            try { return AppResult<BalanceReport>.SuccessResult(await _client.GetBalanceAsync(req)); }
            catch (RpcException e) { return AppResult<BalanceReport>.Failure(e.Status.Detail); }
        }
    }
}
