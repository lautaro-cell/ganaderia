using System.Security.Cryptography;
using System.Text;
using App.Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace App.Infrastructure.Services;

public class EncryptionService : IEncryptionService
{
    private readonly byte[] _key;
    private readonly byte[] _iv;

    public EncryptionService(IConfiguration configuration)
    {
        var keyString = configuration["Encryption:Key"] ?? "averysecretkey123456789012345678"; // 32 chars for AES-256
        _key = Encoding.UTF8.GetBytes(keyString.Substring(0, 32));
        _iv = Encoding.UTF8.GetBytes(keyString.Substring(0, 16));
    }

    public string Encrypt(string clearText)
    {
        using Aes aes = Aes.Create();
        aes.Key = _key;
        aes.IV = _iv;

        ICryptoTransform encryptor = aes.CreateEncryptor(aes.Key, aes.IV);

        using MemoryStream ms = new MemoryStream();
        using CryptoStream cs = new CryptoStream(ms, encryptor, CryptoStreamMode.Write);
        using (StreamWriter sw = new StreamWriter(cs))
        {
            sw.Write(clearText);
        }

        return Convert.ToBase64String(ms.ToArray());
    }

    public string Decrypt(string encryptedText)
    {
        try
        {
            using Aes aes = Aes.Create();
            aes.Key = _key;
            aes.IV = _iv;

            ICryptoTransform decryptor = aes.CreateDecryptor(aes.Key, aes.IV);

            using MemoryStream ms = new MemoryStream(Convert.FromBase64String(encryptedText));
            using CryptoStream cs = new CryptoStream(ms, decryptor, CryptoStreamMode.Read);
            using StreamReader sr = new StreamReader(cs);

            return sr.ReadToEnd();
        }
        catch
        {
            return "ERROR_DECRYPTING";
        }
    }
}
