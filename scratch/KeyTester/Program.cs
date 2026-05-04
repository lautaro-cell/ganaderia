using Microsoft.IdentityModel.Tokens;
using System;
using System.Text;

class Program
{
    static void Main()
    {
        string shortKey = "jwt_DFSDSFSxccfwret";
        try 
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(shortKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            Console.WriteLine("Credentials created successfully.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error creating credentials: {ex.Message}");
        }
    }
}
