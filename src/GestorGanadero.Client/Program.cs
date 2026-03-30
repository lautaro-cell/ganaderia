using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using GestorGanadero.Client;
using Grpc.Net.Client;
using Grpc.Net.Client.Web;
using GestorGanadero.Client.Services;
using GestorGanadero.Client.Infrastructure;
using Microsoft.JSInterop;
using GestorGanadero.Services.Common.Contracts;
using GestorGanadero.Services.Identity.Contracts;
using GestorGanadero.Services.Catalog.Contracts;
using GestorGanadero.Services.Operations.Contracts;
using GestorGanadero.Services.Reporting.Contracts;
using GestorGanadero.Services.Sync.Contracts;
var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

// Phase 0.3 - StateContainer
builder.Services.AddScoped<AppStateContainer>();

// Phase 1.1 - AuthService
builder.Services.AddScoped<IAuthService, AuthService>();

// Phase 0.3 & 0.4 - JWT Handler & gRPC Channel
// Registramos el handler para que pueda ser inyectado (aunque GrpcChannel.ForAddress lo use manualmente)
builder.Services.AddTransient<JwtDelegatingHandler>();

builder.Services.AddSingleton(sp =>
{
    var httpClientHandler = new HttpClientHandler();
    var jsRuntime = sp.GetRequiredService<IJSRuntime>();
    
    var jwtHandler = new JwtDelegatingHandler(jsRuntime)
    {
        InnerHandler = new GrpcWebHandler(GrpcWebMode.GrpcWeb, httpClientHandler)
    };

    return GrpcChannel.ForAddress("http://localhost:5073", new GrpcChannelOptions
    {
        HttpHandler = jwtHandler
    });
});

builder.Services.AddScoped(sp => new GestorGanadero.Services.Identity.Contracts.IdentityService.IdentityServiceClient(sp.GetRequiredService<GrpcChannel>()));
builder.Services.AddScoped(sp => new GestorGanadero.Services.Catalog.Contracts.CatalogService.CatalogServiceClient(sp.GetRequiredService<GrpcChannel>()));
builder.Services.AddScoped(sp => new GestorGanadero.Services.Operations.Contracts.OperationsService.OperationsServiceClient(sp.GetRequiredService<GrpcChannel>()));
builder.Services.AddScoped(sp => new GestorGanadero.Services.Reporting.Contracts.ReportingService.ReportingServiceClient(sp.GetRequiredService<GrpcChannel>()));
builder.Services.AddScoped(sp => new GestorGanadero.Services.Sync.Contracts.SyncService.SyncServiceClient(sp.GetRequiredService<GrpcChannel>()));

// HttpClient base (opcional, pero se mantiene por compatibilidad si se requiere)
builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });

await builder.Build().RunAsync();
