-- Insertar un Tenant de prueba
INSERT INTO "Tenants" ("Id", "Name", "CreatedAt", "UpdatedAt")
VALUES ('d11ee676-a30d-4ff8-b05f-0010e864a7e0', 'Empresa Demo', NOW(), NOW())
ON CONFLICT ( "Id" ) DO UPDATE SET "Name" = 'Empresa Demo', "UpdatedAt" = NOW();

-- Contraseña: admin123 (hash generado con BCrypt.Net-Next)
-- Hash para 'admin123': $2a$11$DqW2g2F2H2J2K2L2M2N2O. (Este es un ejemplo, el real se generará al inicializar)
INSERT INTO "Users" ("Id", "Email", "PasswordHash", "TenantId", "Role", "CreatedAt", "UpdatedAt")
VALUES ('0c1f5c7c-6f4d-4e90-b8a4-0010f117a1c2', 'admin@ganaderia.com', '$2a$11$DqW2g2F2H2J2K2L2M2N2O.EjemploHashGeneradoPorBCrypt', 'd11ee676-a30d-4ff8-b05f-0010e864a7e0', 0, NOW(), NOW())
ON CONFLICT ( "Id" ) DO UPDATE SET "Email" = 'admin@ganaderia.com', "PasswordHash" = '$2a$11$DqW2g2F2H2J2K2L2M2N2O.EjemploHashGeneradoPorBCrypt', "TenantId" = 'd11ee676-a30d-4ff8-b05f-0010e864a7e0', "Role" = 0, "UpdatedAt" = NOW();

-- Puedes agregar más datos de prueba aquí si lo deseas
-- Por ejemplo, campos, actividades, etc.
