using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using GestorGanadero.Client;
using Grpc.Net.Client;
using Grpc.Net.Client.Web;
using GestorGanadero.Client.Services;
using GestorGanadero.Client.Infrastructure;
using GestorGanadero.Grpc.V1;
using Microsoft.JSInterop;

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
    
    // Configuramos el handler de JWT
    var jwtHandler = new JwtDelegatingHandler(jsRuntime)
    {
        InnerHandler = new GrpcWebHandler(GrpcWebMode.GrpcWeb, httpClientHandler)
    };

    // Phase 0.4 - gRPC-Web channel (http://localhost:5073)
    var channel = GrpcChannel.ForAddress("http://localhost:5073", new GrpcChannelOptions
    {
        HttpHandler = jwtHandler
    });

    return new LivestockService.LivestockServiceClient(channel);
});

// HttpClient base (opcional, pero se mantiene por compatibilidad si se requiere)
builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });

await builder.Build().RunAsync();
