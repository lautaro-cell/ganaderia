using BCrypt.Net;
using System;

class Program
{
    static void Main()
    {
        string password = "admin123";
        string hash = BCrypt.Net.BCrypt.HashPassword(password);
        Console.WriteLine($"Correct Hash for 'admin123': {hash}");
    }
}
