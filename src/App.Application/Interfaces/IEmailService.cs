namespace App.Application.Interfaces;

public interface IEmailService
{
    Task SendInvitationAsync(string toEmail, string toName, string fromEmail, string fromName, string inviteToken);
    Task SendPasswordResetAsync(string toEmail, string fromName, string resetToken);
}
