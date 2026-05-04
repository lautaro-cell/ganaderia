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
            Console.WriteLine($"Key created successfully. Length: {shortKey.Length}");
            // In modern .NET, HmacSha256 requires 32 bytes.
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error creating key: {ex.Message}");
        }
    }
}
