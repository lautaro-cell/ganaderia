-- Insertar un Tenant de prueba
INSERT INTO "Tenants" ("Id", "Name", "CreatedAt", "UpdatedAt")
VALUES ('d11ee676-a30d-4ff8-b05f-0010e864a7e0', 'Empresa Demo', NOW(), NOW())
ON CONFLICT ( "Id" ) DO UPDATE SET "Name" = 'Empresa Demo', "UpdatedAt" = NOW();

-- Usuario Administrador de prueba (Rol 0 = Admin)
-- Contraseña: admin123 (hash generado con BCrypt.Net.BCrypt.HashPassword("admin123"))
INSERT INTO "Users" ("Id", "Email", "PasswordHash", "TenantId", "Role", "CreatedAt", "UpdatedAt")
VALUES ('0c1f5c7c-6f4d-4e90-b8a4-0010f117a1c2', 'admin@ganaderia.com', '$2a$11$xmuTPYifanHkM6wZ4M4RnOjxhoOHkHpXUPyJ3UVqaoaRYbzU7f.p.', 'd11ee676-a30d-4ff8-b05f-0010e864a7e0', 0, NOW(), NOW())
ON CONFLICT ( "Id" ) DO UPDATE SET "Email" = 'admin@ganaderia.com', "PasswordHash" = '$2a$11$xmuTPYifanHkM6wZ4M4RnOjxhoOHkHpXUPyJ3UVqaoaRYbzU7f.p.', "TenantId" = 'd11ee676-a30d-4ff8-b05f-0010e864a7e0', "Role" = 0, "UpdatedAt" = NOW();

-- Puedes agregar más datos de prueba aquí si lo deseas
