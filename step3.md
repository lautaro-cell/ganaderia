DI y Controladores
Rol: Desarrollador Backend Senior .NET 10.

Tarea: Configurar la Inyección de Dependencias en Program.cs, crear un proveedor de Tenant para el contexto HTTP y generar el Controlador REST para probar la traducción de eventos. Sigue la regla estricta de un archivo por clase.

1. Proveedor de Tenant (Infraestructura / API):

Crea la interfaz ITenantProvider con una propiedad string TenantId { get; }.

Crea la implementación HttpContextTenantProvider. Debe inyectar IHttpContextAccessor y leer el TenantId desde el header HTTP "X-Tenant-Id". Si no viene, lanzar una excepción o devolver un valor por defecto para testing (ej: "tenant_demo").

2. Configuración de Inyección de Dependencias (Program.cs o DependencyInjection.cs):

Configura el GestorGanaderoDbContext usando PostgreSQL (Npgsql).

Registra el IHttpContextAccessor.

Registra el ITenantProvider con ciclo de vida Scoped.

Registra los servicios de la capa de aplicación (ej. ITranslationService mapeado a su implementación TranslationService) como Scoped.

Agrega los controladores (builder.Services.AddControllers()) y Swagger/OpenAPI.

3. Controlador REST (Controllers/V1/LivestockEventsController.cs):

Crea un controlador API ([ApiController], [Route("api/v1/[controller]")]).

Inyecta ITranslationService.

Crea un endpoint POST {id:guid}/translate.

El endpoint debe llamar a _translationService.TranslateEventToDraftAsync(id).

Manejar las respuestas: 200 OK devolviendo la lista de AccountingDraftDto, o 404 Not Found / 400 Bad Request si ocurre un error lógico.

Escribe el código C# de estos componentes asegurando que la arquitectura se mantenga limpia y lista para ser probada con Postman o Swagger.