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
using Microsoft.AspNetCore.Components.WebAssembly.Authentication;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

builder.Services.AddScoped<AppStateContainer>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddTransient<JwtDelegatingHandler>();


builder.Services.AddScoped(sp => {
    var jwtHandler = sp.GetRequiredService<JwtDelegatingHandler>();
    jwtHandler.InnerHandler = new HttpClientHandler();
    GrpcWebHandler grpcWebHandler = new(GrpcWebMode.GrpcWeb, jwtHandler);
    return GrpcChannel.ForAddress(builder.HostEnvironment.BaseAddress, new GrpcChannelOptions { HttpHandler = grpcWebHandler });
});

builder.Services.AddScoped(sp => new IdentityService.IdentityServiceClient(sp.GetRequiredService<GrpcChannel>()));
builder.Services.AddScoped(sp => new CatalogService.CatalogServiceClient(sp.GetRequiredService<GrpcChannel>()));
builder.Services.AddScoped(sp => new OperationsService.OperationsServiceClient(sp.GetRequiredService<GrpcChannel>()));
builder.Services.AddScoped(sp => new ReportingService.ReportingServiceClient(sp.GetRequiredService<GrpcChannel>()));
builder.Services.AddScoped(sp => new SyncService.SyncServiceClient(sp.GetRequiredService<GrpcChannel>()));
//GRPC clientFactory //grpc.net.clientFactory

builder.Services.AddScoped<IdentityClientService>();
builder.Services.AddScoped<CatalogClientService>();
builder.Services.AddScoped<OperationsClientService>();
builder.Services.AddScoped<ReportingClientService>();
builder.Services.AddScoped<SyncClientService>();

builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });

await builder.Build().RunAsync();

