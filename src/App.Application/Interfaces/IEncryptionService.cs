namespace App.Application.Interfaces;

public interface IEncryptionService
{
    string Encrypt(string clearText);
    string Decrypt(string encryptedText);
}
