using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.JSInterop;
using GestorGanadero.Services.Identity.Contracts;

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
            try
            {
                var response = await _http.PostAsJsonAsync("api/auth/login", new { email, password });

                if (!response.IsSuccessStatusCode)
                    return false;

                var result = await response.Content.ReadFromJsonAsync<LoginResult>();
                if (result == null || string.IsNullOrEmpty(result.Token))
                    return false;

                await _js.InvokeVoidAsync("localStorage.setItem", "authToken", result.Token);

                _state.ActiveTenantId = result.TenantId;
                _state.ActiveTenantName = result.TenantName;
                _state.IsSuperAdmin = result.IsSuperAdmin;

                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Login Error: {ex.Message}");
                return false;
            }
        }

        public async Task LogoutAsync()
        {
            await _js.InvokeVoidAsync("localStorage.removeItem", "authToken");
            _state.CurrentUser = null;
            _state.ActiveTenantId = string.Empty;
            _state.ActiveTenantName = string.Empty;
            _state.AvailableTenants.Clear();
        }

        public async Task LoadUserContextAsync()
        {
            var token = await _js.InvokeAsync<string>("localStorage.getItem", "authToken");
            if (string.IsNullOrEmpty(token)) return;

            try
            {
                var profile = await _grpcClient.GetMyProfileAsync(new Google.Protobuf.WellKnownTypes.Empty());

                TenantList tenantList;
                if (profile.IsSuperAdmin)
                {
                    tenantList = await _grpcClient.GetAllTenantsAsync(new Google.Protobuf.WellKnownTypes.Empty());
                }
                else
                {
                    tenantList = await _grpcClient.GetAvailableTenantsAsync(new Google.Protobuf.WellKnownTypes.Empty());
                }

                _state.CurrentUser = profile;
                _state.IsSuperAdmin = profile.IsSuperAdmin;
                _state.AvailableTenants = tenantList.Tenants.ToList();

                if (_state.AvailableTenants.Any())
                {
                    var active = _state.AvailableTenants.FirstOrDefault(t => t.Id == profile.ActiveTenantId)
                                 ?? _state.AvailableTenants.First();

                    _state.ActiveTenantId = active.Id;
                    _state.ActiveTenantName = active.Name;
                }
            }
            catch (Grpc.Core.RpcException ex)
            {
                Console.WriteLine($"gRPC Context Load Error: {ex.Status.Detail}");
                if (ex.StatusCode == Grpc.Core.StatusCode.Unauthenticated)
                {
                    await LogoutAsync();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"General Context Load Error: {ex.Message}");
            }
        }

        private class LoginResult
        {
            public string Token { get; set; } = string.Empty;
            public string TenantId { get; set; } = string.Empty;
            public string TenantName { get; set; } = string.Empty;
            public bool IsSuperAdmin { get; set; }
        }
    }
}

