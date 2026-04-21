Rol: Arquitecto .NET 10 y gRPC.

Tarea: Implementar el contrato gRPC y el servicio correspondiente para que Blazor WebAssembly pueda consumir la lógica de eventos de forma tipada.

1. Definición del Contrato (Archivo .proto):

Crea el archivo Protos/livestock_v1.proto.

Define el servicio LivestockGrpcService con los métodos:

rpc CreateEvent (CreateEventRequest) returns (CreateEventResponse);

rpc GetPendingEvents (Empty) returns (PendingEventsResponse);

rpc TranslateEvent (TranslateRequest) returns (TranslateResponse);

Usa los tipos de datos de Google (google.protobuf.Timestamp, google.protobuf.StringValue) donde corresponda.

2. Implementación del Servicio gRPC (Capa API):

Crea la clase Grpc/LivestockGrpcServiceImplementation.cs que herede de la base generada por el proto.

Inyecta ILivestockEventService y ITranslationService.

Cada método gRPC debe simplemente llamar a los servicios de la capa de Aplicación que ya implementamos (reutilización total de lógica).

3. Configuración en Program.cs:

Agrega builder.Services.AddGrpc();.

Configura gRPC-Web (app.UseGrpcWeb();) y permite CORS para que el origen de Blazor pueda conectarse.

Mapea el servicio: app.MapGrpcService<LivestockGrpcServiceImplementation>().EnableGrpcWeb();.

4. Proyecto Shared (Opcional pero recomendado):

Si existe un proyecto Shared, coloca ahí el .proto para que Franco pueda referenciarlo directamente desde Blazor.