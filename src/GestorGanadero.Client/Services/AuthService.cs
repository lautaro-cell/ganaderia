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

                var json = await response.Content.ReadFromJsonAsync<JsonDocument>();
                if (json == null) return false;

                var root = json.RootElement;
                var token = root.GetProperty("token").GetString();
                if (string.IsNullOrEmpty(token)) return false;

                var tenantId = root.TryGetProperty("tenantId", out var tid) ? tid.GetString() ?? "" : "";
                var tenantName = root.TryGetProperty("tenantName", out var tn) ? tn.GetString() ?? "" : "";
                var isSuperAdmin = root.TryGetProperty("isSuperAdmin", out var isa) && isa.GetBoolean();

                await _js.InvokeVoidAsync("localStorage.setItem", "authToken", token);

                _state.ActiveTenantId = tenantId;
                _state.ActiveTenantName = tenantName;
                _state.IsSuperAdmin = isSuperAdmin;

                await _js.InvokeVoidAsync("localStorage.setItem", "isSuperAdmin", isSuperAdmin ? "1" : "0");

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
            await _js.InvokeVoidAsync("localStorage.removeItem", "isSuperAdmin");
            _state.CurrentUser = null;
            _state.ActiveTenantId = string.Empty;
            _state.ActiveTenantName = string.Empty;
            _state.IsSuperAdmin = false;
            _state.AvailableTenants.Clear();
        }

        public async Task LoadUserContextAsync()
        {
            var token = await _js.InvokeAsync<string>("localStorage.getItem", "authToken");
            if (string.IsNullOrEmpty(token)) return;

            var cachedSuperAdmin = await _js.InvokeAsync<string>("localStorage.getItem", "isSuperAdmin");
            _state.IsSuperAdmin = cachedSuperAdmin == "1";

            try
            {
                var profile = await _grpcClient.GetMyProfileAsync(new Google.Protobuf.WellKnownTypes.Empty());
                _state.CurrentUser = profile;
                _state.IsSuperAdmin = profile.IsSuperAdmin || _state.IsSuperAdmin;

                TenantList tenantList;
                if (profile.IsSuperAdmin)
                {
                    try
                    {
                        tenantList = await _grpcClient.GetAllTenantsAsync(new Google.Protobuf.WellKnownTypes.Empty());
                    }
                    catch
                    {
                        tenantList = await _grpcClient.GetAvailableTenantsAsync(new Google.Protobuf.WellKnownTypes.Empty());
                    }
                }
                else
                {
                    tenantList = await _grpcClient.GetAvailableTenantsAsync(new Google.Protobuf.WellKnownTypes.Empty());
                }

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



    }
}

