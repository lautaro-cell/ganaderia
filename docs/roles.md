Está funcionando el envío de emails?
No, actualmente no está implementado el envío de correos electrónicos. Revisé el código en UserService.cs (InviteUserAsync). El proceso actual de "invitación" hace lo siguiente:

Recibe el Email, Nombre y Rol.
Genera una contraseña aleatoria y la encripta en la base de datos.
Guarda al usuario con el estado IsActive = false.
Falta implementar:

La integración con un servicio de correo (como SendGrid, AWS SES, o un SMTP común) para disparar el email real.
El flujo en la interfaz de usuario para que el invitado reciba un link mágico (token) o la contraseña temporal, entre a la plataforma y pueda configurar su contraseña definitiva.
2. Aislamiento de información por Empresa (Multi-Tenant)
Sí, el aislamiento estricto de datos ya está implementado. El sistema está construido con una arquitectura "Multi-Tenant" utilizando Global Query Filters de Entity Framework en la base de datos. Esto significa que:

Si el dueño de una empresa (Empresa A) inicia sesión, es matemáticamente imposible que vea usuarios, eventos, parcelas o hacienda de la Empresa B.
Cualquier consulta a la base de datos, en el momento de ejecutarse, inyecta por detrás una condición automática WHERE TenantId = 'Id-de-su-empresa'.
El dueño de la empresa entra a "Usuarios" y solo puede administrar a sus empleados.
3. Aclaración sobre tu rol actual ("Admin de Gestor Ganadero")
Mencionaste que estás como administrador general y puedes "manejar Tenants". En realidad, si revisamos el código de cómo se traen los Tenants:

csharp
// UserService.cs
return await _context.Tenants
    .IgnoreQueryFilters()
    .Where(t => t.Id == tenantId) // <-- Filtro estricto
    .ToListAsync();
El sistema actual no tiene un verdadero rol de "Súper Administrador Global". El seed de la base de datos te creó a vos (admin@ganaderia.com) dentro del Tenant Número 1. Vos estás administrando ese "Tenant 1", y la pantalla de Empresas que ves, en realidad te está permitiendo configurar únicamente tu propia empresa (conectarla con GestorMax, ver su estado de conexión, etc.), no te está mostrando el listado de todos los clientes de la plataforma.

¿Qué deberíamos hacer a futuro?

Flujo de Invitación: Integrar un servidor SMTP para enviar el correo con un link con Token (ej: /crear-password?token=xxx).
Rol "Súper Admin" (Gestor Ganadero Dueño): Si vas a comercializar esto como un SaaS y necesitás un panel central para dar de alta o bloquear clientes (Tenants), tenemos que crear un rol especial (SuperAdmin) y modificar el backend para que, solo si tienes ese rol, el sistema ignore el filtro de Tenant y te liste todas las empresas de la base de datos.
¿Querés que nos enfoquemos en implementar el envío de emails para las invitaciones, o armamos primero el rol de Súper Administrador real?