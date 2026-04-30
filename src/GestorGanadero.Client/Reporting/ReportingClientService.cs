using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Threading;
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
                var yieldedAny = false;
                AsyncServerStreamingCall<LedgerEntry>? call = null;
                IAsyncEnumerator<LedgerEntry>? enumerator = null;
                Exception? error = null;

                try
                {
                    call = _client.GetLedger(filter, cancellationToken: ct);
                    enumerator = call.ResponseStream.ReadAllAsync(ct).GetAsyncEnumerator(ct);
                }
                catch (Exception ex)
                {
                    error = ex;
                }

                if (error == null && enumerator != null)
                {
                    while (true)
                    {
                        try
                        {
                            if (!await enumerator.MoveNextAsync())
                                break;
                        }
                        catch (Exception ex)
                        {
                            error = ex;
                            break;
                        }

                        yieldedAny = true;
                        yield return enumerator.Current;
                    }
                }

                if (enumerator != null) await enumerator.DisposeAsync();
                call?.Dispose();

                if (error == null || error is OperationCanceledException)
                {
                    yield break;
                }

                if (error is RpcException && !yieldedAny && attempt < maxAttempts)
                {
                    await Task.Delay(TimeSpan.FromSeconds(Math.Pow(2, attempt - 1)), ct);
                    continue;
                }

                throw error;
            }
        }

        public async Task<AppResult<BalanceReport>> GetBalanceAsync(GetBalanceRequest req)
        {
            try { return AppResult<BalanceReport>.SuccessResult(await _client.GetBalanceAsync(req)); }
            catch (RpcException e) { return AppResult<BalanceReport>.Failure(e.Status.Detail); }
        }
    }
}

