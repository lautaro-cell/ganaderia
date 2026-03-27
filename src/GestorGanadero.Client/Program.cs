using System.Net.Http;
using Grpc.Net.Client;
using Grpc.Net.Client.Web;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using GestorGanadero.Client;
using GestorGanadero.Client.Services;
using GestorGanadero.Client.Infrastructure;
using GestorGanadero.Grpc.V1;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

// Register AppState
builder.Services.AddScoped<AppState>();

// Register Interceptor
builder.Services.AddTransient<GrpcInterceptor>();

// Configure gRPC Client
builder.Services.AddScoped(sp =>
{
    var appState = sp.GetRequiredService<AppState>();
    var interceptor = sp.GetRequiredService<GrpcInterceptor>();
    
    // For now, using HostEnvironment.BaseAddress as backend URL. 
    // In production, this should be configurable.
    var backendUrl = builder.HostEnvironment.BaseAddress;
    
    var handler = new GrpcWebHandler(GrpcWebMode.GrpcWebText, new HttpClientHandler());
    interceptor.InnerHandler = handler;
    
    var channel = GrpcChannel.ForAddress(backendUrl, new GrpcChannelOptions 
    { 
        HttpHandler = interceptor 
    });
    
    return new LivestockService.LivestockServiceClient(channel);
});

builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });

await builder.Build().RunAsync();
