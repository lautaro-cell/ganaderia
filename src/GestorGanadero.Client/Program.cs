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
using GestorGanadero.Client.Identity;
using GestorGanadero.Client.Catalog;
using GestorGanadero.Client.Operations;
using GestorGanadero.Client.Reporting;
using GestorGanadero.Client.Sync;
using System.Net.Http;
using System;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

builder.Services.AddScoped<AppStateContainer>();
builder.Services.AddSingleton<TenantState>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddTransient<JwtDelegatingHandler>();

builder.Services.AddSingleton(sp =>
{
    var httpClientHandler = new HttpClientHandler();
    var grpcHandler = new GrpcWebHandler(GrpcWebMode.GrpcWeb, httpClientHandler);
    
    var jsRuntime = sp.GetRequiredService<IJSRuntime>();
    var jwtHandler = new JwtDelegatingHandler(jsRuntime)
    {
        InnerHandler = grpcHandler
    };

    var grpcUrl = builder.Configuration["GrpcServer:Url"] ?? "https://localhost:7240";
    return GrpcChannel.ForAddress(grpcUrl, new GrpcChannelOptions
    {
        HttpHandler = jwtHandler
    });
});

builder.Services.AddScoped(sp => new IdentityService.IdentityServiceClient(sp.GetRequiredService<GrpcChannel>()));
builder.Services.AddScoped(sp => new CatalogService.CatalogServiceClient(sp.GetRequiredService<GrpcChannel>()));
builder.Services.AddScoped(sp => new OperationsService.OperationsServiceClient(sp.GetRequiredService<GrpcChannel>()));
builder.Services.AddScoped(sp => new ReportingService.ReportingServiceClient(sp.GetRequiredService<GrpcChannel>()));
builder.Services.AddScoped(sp => new SyncService.SyncServiceClient(sp.GetRequiredService<GrpcChannel>()));

builder.Services.AddScoped<IdentityClientService>();
builder.Services.AddScoped<CatalogClientService>();
builder.Services.AddScoped<OperationsClientService>();
builder.Services.AddScoped<ReportingClientService>();
builder.Services.AddScoped<SyncClientService>();

builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });

await builder.Build().RunAsync();

