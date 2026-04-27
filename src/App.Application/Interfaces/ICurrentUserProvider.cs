namespace App.Application.Interfaces;

public interface ICurrentUserProvider
{
    Guid? UserId { get; }
}
