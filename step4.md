Rol: Desarrollador Backend Senior .NET 10.

Tarea: Implementar el flujo de creación y lectura de eventos operativos (Módulo 4) en la capa de Aplicación y exponerlos en el LivestockEventsController.

1. DTOs de Entrada y Salida (Capa Application / DTOs):

Crea un record CreateLivestockEventRequest:

Guid EventTemplateId

string CostCenterCode

int HeadCount

decimal EstimatedWeightKg

decimal TotalAmount

DateTimeOffset EventDate

Crea un record LivestockEventResponse (para devolver los datos al listar):

Guid Id

Guid EventTemplateId

string CostCenterCode

int HeadCount

decimal EstimatedWeightKg

decimal TotalAmount

string Status (String mapeado desde el Enum)

DateTimeOffset EventDate

2. Interfaz y Servicio (Capa Application):

En ILivestockEventService, agrega dos métodos:

Task<Guid> CreateEventAsync(CreateLivestockEventRequest request);

Task<IEnumerable<LivestockEventResponse>> GetPendingEventsAsync(); (Debe devolver solo los que están en estado Draft).

Implementa la clase LivestockEventService:

CreateEventAsync: Mapea el request a la entidad LivestockEvent, fuerza el Status = LivestockEventStatus.Draft, guarda en el DbContext y retorna el nuevo Id.

GetPendingEventsAsync: Consulta el DbContext, filtra por Status == Draft (recuerda que el Tenant se filtra solo) y mapea a LivestockEventResponse.

3. Actualizar Controlador (LivestockEventsController):

Inyecta ILivestockEventService.

Crea el endpoint POST /api/v1/livestockevents que reciba el CreateLivestockEventRequest y devuelva 201 Created con el ID generado.

Crea el endpoint GET /api/v1/livestockevents/pending que devuelva la lista de LivestockEventResponse (HTTP 200).

Escribe el código respetando la regla de un archivo por clase e Inyección de Dependencias.