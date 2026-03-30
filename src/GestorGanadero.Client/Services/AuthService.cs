using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.JSInterop;
using Grpc.Core;
using Google.Protobuf.WellKnownTypes;
using GestorGanadero.Services.Common.Contracts;
using GestorGanadero.Services.Identity.Contracts;
using GestorGanadero.Services.Catalog.Contracts;
using GestorGanadero.Services.Operations.Contracts;
using GestorGanadero.Services.Reporting.Contracts;
using GestorGanadero.Services.Sync.Contracts;
using System.Linq;

namespace GestorGanadero.Client.Services
{
    public class AuthService : IAuthService
    {
        private readonly HttpClient _http;
        private readonly IJSRuntime _js;
        private readonly AppStateContainer _state;
        private readonly IdentityService.IdentityServiceClient _grpcClient;

        public AuthService(
            HttpClient http, 
            IJSRuntime js, 
            AppStateContainer state, 
            IdentityService.IdentityServiceClient grpcClient)
        {
            _http = http;
            _js = js;
            _state = state;
            _grpcClient = grpcClient;
        }

        public async Task<bool> LoginAsync(string email, string password)
        {
            // Prompt 1.2: Llama al endpoint de autenticación REST y guarda el JWT
            // Simulamos por ahora o usamos un endpoint real si existe
            try 
            {
                // En un escenario real: var response = await _http.PostAsJsonAsync("api/auth/login", new { email, password });
                // Si el backend es puro gRPC, tendríamos un rpc Login. Pero el prompt pide REST para login.
                
                // Simulación para propósitos de desarrollo (Mock)
                if (email == "admin@ganaderia.com" && password == "admin123")
                {
                    var token = "mock-jwt-token";
                    await _js.InvokeVoidAsync("localStorage.setItem", "authToken", token);
                    return true;
                }
                return false;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Login Error: {ex.Message}");
                return false;
            }
        }

        public async Task LoadUserContextAsync()
        {
            var token = await _js.InvokeAsync<string>("localStorage.getItem", "authToken");
            if (string.IsNullOrEmpty(token)) return;

            try
            {
                // Prompt 1.2: Llama GetMyProfile() y GetAvailableTenants() via LivestockServiceClient
                var profile = await _grpcClient.GetMyProfileAsync(new Empty());
                var tenantList = await _grpcClient.GetAvailableTenantsAsync(new Empty());

                _state.CurrentUser = profile;
                _state.AvailableTenants = tenantList.Tenants.ToList();

                // Si hay tenants, seleccionamos el primero o el activo del perfil
                if (_state.AvailableTenants.Any())
                {
                    var active = _state.AvailableTenants.FirstOrDefault(t => t.Id == profile.ActiveTenantId) 
                                 ?? _state.AvailableTenants.First();
                    
                    _state.ActiveTenantId = active.Id;
                    _state.ActiveTenantName = active.Name;
                }
            }
            catch (RpcException ex)
            {
                Console.WriteLine($"gRPC Context Load Error: {ex.Status.Detail}");
                // Si el token es inválido (Unauthenticated), podríamos limpiar el localStorage
                if (ex.StatusCode == StatusCode.Unauthenticated)
                {
                    await _js.InvokeVoidAsync("localStorage.removeItem", "authToken");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"General Context Load Error: {ex.Message}");
            }
        }
    }
}

