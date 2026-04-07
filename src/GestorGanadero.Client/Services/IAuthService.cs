namespace GestorGanadero.Client.Services
{
    public interface IAuthService
    {
        Task<bool> LoginAsync(string email, string password);
        Task LogoutAsync();
        Task LoadUserContextAsync();
    }
}

