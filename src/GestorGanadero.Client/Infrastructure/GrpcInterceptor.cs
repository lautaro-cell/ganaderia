using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading;
using System.Threading.Tasks;
using GestorGanadero.Client.Services;

namespace GestorGanadero.Client.Infrastructure;

public class GrpcInterceptor : DelegatingHandler
{
    private readonly AppState _appState;

    public GrpcInterceptor(AppState appState)
    {
        _appState = appState;
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrEmpty(_appState.AuthToken))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _appState.AuthToken);
        }

        if (!string.IsNullOrEmpty(_appState.SelectedTenantId))
        {
            request.Headers.Add("x-tenant-id", _appState.SelectedTenantId);
        }

        // gRPC-Web requires some specific headers or behavior usually handled by the GrpcWebHandler, 
        // but here we just inject our custom context headers.
        
        return await base.SendAsync(request, cancellationToken);
    }
}
