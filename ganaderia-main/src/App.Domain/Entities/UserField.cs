namespace App.Domain.Entities;

/// <summary>
/// Join M:N entre User y Field — qué campos puede operar cada usuario.
/// </summary>
public class UserField
{
    public Guid UserId { get; set; }
    public Guid FieldId { get; set; }

    public User? User { get; set; }
    public Field? Field { get; set; }
}
