using BCrypt.Net;
using System;

class Program
{
    static void Main()
    {
        string password = "admin123";
        string hash = "$2a$11$mH/hXlX2M/vN6vYc6uS2uevW.3rW9oH/6oR1.a8uK4XQ5pG3O6E6e";
        bool result = BCrypt.Net.BCrypt.Verify(password, hash);
        Console.WriteLine($"Verification result for 'admin123': {result}");
    }
}
