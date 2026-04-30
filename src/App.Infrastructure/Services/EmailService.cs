using App.Application.Interfaces;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;

namespace App.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly SmtpOptions _options;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IOptions<SmtpOptions> options, ILogger<EmailService> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendInvitationAsync(string toEmail, string toName, string fromEmail, string fromName, string inviteToken)
    {
        var subject = $"Invitación a Gestor Ganadero — {fromName}";
        var resetUrl = $"/crear-password?token={inviteToken}";

        var html = $"""
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden;">
                <div style="background-color: #dc2626; padding: 24px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 20px;">Gestor Ganadero</h1>
                </div>
                <div style="padding: 32px 24px;">
                    <p style="margin: 0 0 16px; font-size: 16px;">Hola <strong>{toName}</strong>,</p>
                    <p style="margin: 0 0 24px; font-size: 14px; color: #444;">
                        <strong>{fromName} ({fromEmail})</strong> te ha invitado a unirte a <strong>Gestor Ganadero</strong>.
                    </p>
                    <p style="margin: 0 0 24px; font-size: 14px; color: #444;">
                        Hacé clic en el botón para configurar tu contraseña y acceder a la plataforma:
                    </p>
                    <p style="text-align: center; margin: 0 0 24px;">
                        <a href="{resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px;">
                            Crear Contraseña
                        </a>
                    </p>
                    <p style="margin: 0 0 8px; font-size: 12px; color: #888;">
                        Si el botón no funciona, copiá y pegá este enlace en tu navegador:
                    </p>
                    <p style="margin: 0 0 24px; font-size: 12px; color: #888; word-break: break-all;">
                        {resetUrl}
                    </p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 0 0 16px;" />
                    <p style="margin: 0; font-size: 12px; color: #aaa;">
                        Este enlace expira en 7 días. Si no esperabas esta invitación, ignorá este correo.
                    </p>
                </div>
            </div>
            """;

        await SendEmailAsync(toEmail, toName, fromEmail, fromName, subject, html);
    }

    public async Task SendPasswordResetAsync(string toEmail, string fromName, string resetToken)
    {
        var subject = "Restablecer Contraseña — Gestor Ganadero";
        var resetUrl = $"/reset-password?token={resetToken}";
        var systemEmail = _options.Username ?? "noreply@sistema.com";

        var html = $"""
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden;">
                <div style="background-color: #dc2626; padding: 24px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 20px;">Gestor Ganadero</h1>
                </div>
                <div style="padding: 32px 24px;">
                    <p style="margin: 0 0 16px; font-size: 16px;">Hola{(!string.IsNullOrEmpty(fromName) ? $" <strong>{fromName}</strong>" : "")},</p>
                    <p style="margin: 0 0 24px; font-size: 14px; color: #444;">
                        Recibimos una solicitud para restablecer tu contraseña.
                    </p>
                    <p style="text-align: center; margin: 0 0 24px;">
                        <a href="{resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px;">
                            Restablecer Contraseña
                        </a>
                    </p>
                    <p style="margin: 0 0 8px; font-size: 12px; color: #888;">
                        O copiá este enlace: {resetUrl}
                    </p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 0 0 16px;" />
                    <p style="margin: 0; font-size: 12px; color: #aaa;">
                        Este enlace expira en 1 hora. Si no solicitaste este cambio, ignorá este correo.
                    </p>
                </div>
            </div>
            """;

        await SendEmailAsync(toEmail, fromName, systemEmail, "Gestor Ganadero", subject, html);
    }

    private async Task SendEmailAsync(string toEmail, string toName, string fromEmail, string fromName, string subject, string htmlBody)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromEmail));
        message.To.Add(new MailboxAddress(toName, toEmail));
        message.Subject = subject;

        if (!string.IsNullOrEmpty(_options.Username) && !string.IsNullOrEmpty(_options.Password))
        {
            message.Sender = new MailboxAddress("Gestor Ganadero", _options.Username);
        }

        message.Body = new TextPart("html")
        {
            Text = htmlBody
        };

        using var client = new SmtpClient();
        try
        {
            var secureOption = _options.UseSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls;

            await client.ConnectAsync(_options.Host, _options.Port, secureOption);

            if (!string.IsNullOrEmpty(_options.Username) && !string.IsNullOrEmpty(_options.Password))
            {
                await client.AuthenticateAsync(_options.Username, _options.Password);
            }

            await client.SendAsync(message);
            await client.DisconnectAsync(true);

            _logger.LogInformation("Email enviado a {Email} como {FromEmail} con asunto '{Subject}'", toEmail, fromEmail, subject);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Fallo al enviar email a {Email}", toEmail);
            throw;
        }
    }
}
