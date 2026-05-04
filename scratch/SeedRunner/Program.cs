Jwt__Key="jwt_DFSDSFSxccfwret"using Npgsql;
using System;
using System.Threading.Tasks;

namespace SeedRunner;

class Program
{
    static async Task Main(string[] args)
    {
        string connString = "Host=localhost;Port=5433;Database=gestor_ganadero;Username=postgres;Password=password";
        string correctHash = "$2a$11$3ZEc5MO5HmT8sHmKR823seywvxbT0yLDZpca3oz904DN1cB3q8.ZC";
        
        try 
        {
            using var conn = new NpgsqlConnection(connString);
            await conn.OpenAsync();

            Console.WriteLine("Updating all users to have the correct password hash...");
            string query = "UPDATE \"Users\" SET \"PasswordHash\" = @hash;";
            using var cmd = new NpgsqlCommand(query, conn);
            cmd.Parameters.AddWithValue("hash", correctHash);
            int rows = await cmd.ExecuteNonQueryAsync();

            Console.WriteLine($"Updated {rows} users.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
        }
    }
}
