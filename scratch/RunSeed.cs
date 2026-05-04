using Microsoft.Extensions.Configuration;
using Npgsql;
using System;
using System.IO;
using System.Threading.Tasks;

class Program
{
    static async Task Main(string[] args)
    {
        string connString = "Host=localhost;Port=5433;Database=gestor_ganadero;Username=postgres;Password=password";
        string sqlPath = @"c:\Users\HWLScuffi\workspace\ganaderia\src\GestorGanadero.Server\sql\data.sql";

        Console.WriteLine("Connecting to database...");
        using var conn = new NpgsqlConnection(connString);
        await conn.OpenAsync();

        Console.WriteLine("Reading SQL file...");
        string sql = await File.ReadAllTextAsync(sqlPath);

        Console.WriteLine("Executing SQL...");
        using var cmd = new NpgsqlCommand(sql, conn);
        await cmd.ExecuteNonQueryAsync();

        Console.WriteLine("Seed completed successfully.");
    }
}
