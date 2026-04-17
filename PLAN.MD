1. Resumen Ejecutivo
Este documento es el resultado del análisis comparativo entre dos artefactos de software:
•	ganaderia-main (C# / .NET 10 / Blazor WASM): el proyecto principal con arquitectura limpia, compilación con errores activos.
•	Ganadero-Digital-main (TypeScript / Node.js): el prototipo funcional que resuelve correctamente la lógica de negocio core.

El análisis revela que el proyecto C# tiene una estructura arquitectónica sólida pero presenta cuatro brechas críticas que impiden su correcto funcionamiento. Este documento define el plan exacto para cerrar esas brechas, con código de referencia extraído del prototipo.

2. Diagnóstico: Comparativa de Ambos Sistemas
2.1 Estado del Proyecto C# (ganaderia-main)
Componente	Estado	Observación
Arquitectura (Clean)	✅ Sólida	Domain / Application / Infrastructure / Server / Client bien separados
Blazor WASM + gRPC-Web	✅ Correcto	Comunicación binaria configurada, protos definidos
NodaTime en Domain	✅ Correcto	Instant en LivestockEvent y ExternalCatalog
NodaTime en Application	❌ Error de build	Instant.UtcNow no existe en NodaTime
Lógica de traducción	❌ Incompleta	TranslationService ignora el tipo de evento
Balance (ReportService)	❌ Incorrecto	Consulta LivestockEvents en lugar de AccountingDrafts
Enum EventType	⚠️ Incompleto	Faltan 5 tipos de eventos del prototipo
Sistema de categorías	⚠️ Parcial	Sin distinción CLIENTE / GESTOR implementada

2.2 Funcionalidades Core del Prototipo TypeScript
El prototipo resuelve correctamente las siguientes funcionalidades que deben portarse:
•	Motor de generación de asientos contables basado en tipo de evento (función generateAsientos)
•	Casos especiales: TRASLADO (cross-campo), CAMBIO_ACTIVIDAD, CAMBIO_CATEGORIA, AJUSTE_KG (sign-aware), RECUENTO (sin asientos)
•	Balance jerárquico consultando la tabla de asientos, no de eventos
•	Mayor con paginación, filtros por fecha y búsqueda por cuenta/concepto
•	Sistema de dos niveles de categorías: CLIENTE (operativo) y GESTOR (consolidado para reporting)

3. Problemas Críticos y Soluciones
3.1 Error de Build — NodaTime: Instant.UtcNow
🔴  BLOQUEANTE  —  2 errores de compilación activos
App.Application/Services/SyncCatalogService.cs líneas 39 y 49: 'Instant' no contiene una definición para 'UtcNow'

Causa
En NodaTime no existe Instant.UtcNow. El acceso al instante actual se obtiene a través del reloj del sistema.
Código con error (líneas 39 y 49)
existingCatalog.LastSyncedAt = Instant.UtcNow;  // ❌ No existe
LastSyncedAt = Instant.UtcNow                   // ❌ No existe
Corrección
existingCatalog.LastSyncedAt = SystemClock.Instance.GetCurrentInstant();  // ✅
LastSyncedAt = SystemClock.Instance.GetCurrentInstant()                   // ✅

El objeto SystemClock ya está disponible porque el using NodaTime; está presente en el archivo. No requiere ninguna dependencia adicional.

3.2 Enum EventType Incompleto
Estado actual vs. requerido
Enum actual en C#	Enum requerido (del prototipo)
Nacimiento, Compra, Venta, Muerte, Sanidad, Alimentacion, Pesaje, Movimiento	Apertura, Nacimiento, Destete, Compra, Venta, Mortandad, Consumo, Traslado, CambioActividad, CambioCategoria, AjusteKg, Recuento
Reemplazo completo de App.Domain/Enums/EventType.cs
// App.Domain/Enums/EventType.cs
public enum EventType
{
    Apertura,         // ACT001 DEBE  / PN001 HABER
    Nacimiento,        // ACT001 DEBE  / PN001 HABER
    Destete,           // ACT001 DEBE  / PN001 HABER
    Compra,            // ACT001 DEBE  / RES002 HABER
    Venta,             // RES001 DEBE  / ACT001 HABER
    Mortandad,         // RES003 DEBE  / ACT001 HABER
    Consumo,           // RES004 DEBE  / ACT001 HABER
    Traslado,          // ACT001 DEBE campo_destino / ACT001 HABER campo_origen
    CambioActividad,   // ACT001 DEBE act_destino   / ACT001 HABER act_origen
    CambioCategoria,   // ACT001 DEBE cat_destino   / ACT001 HABER cat_origen
    AjusteKg,          // Direccional según signo de kg
    Recuento           // Informativo — NO genera asientos
}

3.3 TranslationService Incompleto — Brecha de Lógica Contable
Problema
El TranslationService actual ignora el EventType y aplica siempre el mismo par Debe/Haber tomado del EventTemplate. Esto es incorrecto para los tipos de eventos con lógica especial: Traslado, CambioActividad, CambioCategoria, AjusteKg y Recuento.

⚠️  IMPACTO
Un TRASLADO entre campos generaría un asiento en una sola cuenta, sin cross-reference entre campos. Un RECUENTO generaría asientos cuando no debería. Un AJUSTE_KG negativo generaría el débito y crédito al revés.

Modelo mental: Unidad de cuenta
En el prototipo TypeScript, la unidad contable primaria es CABEZAS y KG (stock físico), no importe monetario. El campo TotalAmount de LivestockEvent es secundario. El AccountingDraft debe registrar HeadCount y WeightKg en todos los asientos.

Plan de refactoring de TranslationService
Reemplazar el método TranslateEventToDraftAsync con la siguiente lógica ramificada:

// App.Application/Services/TranslationService.cs — nuevo núcleo
private IEnumerable<AccountingDraft> BuildDrafts(LivestockEvent ev)
{
    var tipo = ev.EventTemplate!.EventType;
    var concept = BuildConcept(ev);
    var amount = ev.TotalAmount;
    var heads  = ev.HeadCount;
    var kg     = ev.EstimatedWeightKg;

    // Mapa simple: la mayoría de tipos usan el par fijo del template
    var simpleTipos = new HashSet<EventType> {
        EventType.Apertura, EventType.Nacimiento, EventType.Destete,
        EventType.Compra, EventType.Venta, EventType.Mortandad, EventType.Consumo
    };

    if (simpleTipos.Contains(tipo))
        return BuildSimplePair(ev, concept, amount, heads, kg);

    return tipo switch {
        EventType.Traslado        => BuildTraslado(ev, concept, heads, kg),
        EventType.CambioActividad  => BuildCambioActividad(ev, concept, heads, kg),
        EventType.CambioCategoria  => BuildCambioCategoria(ev, concept, heads, kg),
        EventType.AjusteKg         => BuildAjusteKg(ev, concept, kg),
        EventType.Recuento         => Enumerable.Empty<AccountingDraft>(),
        _ => BuildSimplePair(ev, concept, amount, heads, kg)
    };
}

Métodos auxiliares clave
// Par simple: usa DebitAccountCode y CreditAccountCode del template
private IEnumerable<AccountingDraft> BuildSimplePair(LivestockEvent ev, string concept, decimal amount, int heads, decimal kg)
    => [ MakeDraft(ev, ev.EventTemplate!.DebitAccountCode,  concept, amount, 0,      heads, kg, "DEBE"),
          MakeDraft(ev, ev.EventTemplate!.CreditAccountCode, concept, 0,      amount, heads, kg, "HABER") ];

// Traslado: misma cuenta (ACT001), campos distintos
private IEnumerable<AccountingDraft> BuildTraslado(LivestockEvent ev, string concept, int heads, decimal kg)
    => [ MakeDraft(ev, "ACT001", concept, heads, 0,     heads, kg, "DEBE",  destinoFieldId: ev.DestinationFieldId),
          MakeDraft(ev, "ACT001", concept, 0,     heads, heads, kg, "HABER", origenFieldId:  ev.FieldId) ];

// AjusteKg: dirección según signo
private IEnumerable<AccountingDraft> BuildAjusteKg(LivestockEvent ev, string concept, decimal kg)
{
    var absKg = Math.Abs(kg);
    return kg >= 0
        ? [ MakeDraft(ev, "ACT001", concept, absKg, 0,     0, absKg, "DEBE" ),
             MakeDraft(ev, "RES008", concept, 0,     absKg, 0, absKg, "HABER") ]
        : [ MakeDraft(ev, "RES008", concept, absKg, 0,     0, absKg, "DEBE" ),
             MakeDraft(ev, "ACT001", concept, 0,     absKg, 0, absKg, "HABER") ];
}

3.4 ReportService.GetBalanceAsync — Consulta la Entidad Incorrecta
Problema
El método actual agrupa LivestockEvents, lo que solo refleja el stock físico registrado por el operador. El balance contable correcto debe derivarse de los AccountingDrafts (asientos), agrupados por código de cuenta, sumando los saldos Debe y Haber para obtener el saldo neto.

Query correcta — portada del prototipo TypeScript
// Consulta base del balance en el prototipo (equivalente en LINQ)
var balance = await _context.AccountingDrafts
    .Include(a => a.LivestockEvent).ThenInclude(e => e!.Field)
    .Include(a => a.LivestockEvent).ThenInclude(e => e!.Activity)
    .Include(a => a.LivestockEvent).ThenInclude(e => e!.Category)
    .Where(a => a.TenantId == tenantId)
    .Where(a => !date.HasValue || a.LivestockEvent!.EventDate <= date.Value)
    .GroupBy(a => new {
        a.AccountCode,
        FieldName  = a.LivestockEvent!.Field     != null ? a.LivestockEvent.Field.Name     : "Sin Campo",
        ActivityName = a.LivestockEvent!.Activity != null ? a.LivestockEvent.Activity.Name : "Sin Actividad",
        CategoryName = a.LivestockEvent!.Category != null ? a.LivestockEvent.Category.Name : "Sin Categoría",
    })
    .Select(g => new BalanceItemDto(
        g.Key.FieldName,
        g.Key.CategoryName,
        g.Sum(a => a.EntryType == "DEBE" ? a.HeadCount : -a.HeadCount),
        g.Sum(a => a.EntryType == "DEBE" ? (a.WeightKg ?? 0) : -(a.WeightKg ?? 0)),
        g.Key.ActivityName,
        AccountCode: g.Key.AccountCode,
        DebitTotal:  g.Sum(a => a.DebitAmount),
        CreditTotal: g.Sum(a => a.CreditAmount),
        NetBalance:  g.Sum(a => a.DebitAmount - a.CreditAmount)
    ))
    .ToListAsync();

📌  Nota sobre BalanceItemDto
Extender el record BalanceItemDto para incluir AccountCode, DebitTotal, CreditTotal y NetBalance. El Balance.razor ya tiene la UI para mostrar estas columnas pero el backend no las provee.

3.5 Sistema de Dos Niveles de Categorías — CLIENTE / GESTOR
Descripción del sistema en el prototipo
El prototipo implementa un sistema de categorías en dos niveles que es fundamental para el reporting consolidado:

Tipo	Propósito	Origen
CLIENTE	Categorías usadas por el operador al registrar eventos. Vocabulario propio del establecimiento.	Definidas manualmente o importadas por CSV por el administrador del tenant.
GESTOR	Categorías normalizadas de Gestor Max. Usadas para el reporting consolidado multi-tenant.	Sincronizadas desde la API de GestorMax (SyncCatalogService). tipo='GESTOR' con external_id.

Tabla de mapeo en C#
Existe la entidad CategoryMapping en el domain. Verificar que el enum CategoryType.cs contenga los valores Cliente y Gestor, y que CatalogService resuelva el mapeo al generar reportes.
// App.Domain/Enums/CategoryType.cs — verificar que contenga:
public enum CategoryType { Cliente, Gestor }

El Balance.razor ya incluye el toggle Cliente/Gestor en la UI. El ReportService debe aceptar el parámetro categoryView y hacer el JOIN con CategoryMapping cuando el valor sea "gestor".

4. Plan de Implementación por Fases
Fase 1 — Correcciones de Compilación (Urgente, ~30 min)
Objetivo: lograr que la solución compile sin errores.

#	Acción	Archivo
1	Reemplazar Instant.UtcNow por SystemClock.Instance.GetCurrentInstant() (líneas 39 y 49)	App.Application/Services/SyncCatalogService.cs
2	Ejecutar dotnet build y confirmar 0 errores	CLI

Fase 2 — Dominio Completo (~2 horas)
Objetivo: que el modelo de dominio represente correctamente todos los eventos ganaderos.

•	Reemplazar EventType.cs con el enum completo de 12 valores (ver sección 3.2)
•	Agregar campo DestinationFieldId (Guid?) a LivestockEvent para soportar TRASLADO
•	Agregar campos OriginCategoryId y DestinationCategoryId (Guid?) para CAMBIO_CATEGORIA
•	Agregar campos OriginActivityId y DestinationActivityId (Guid?) para CAMBIO_ACTIVIDAD
•	Generar nueva migración de EF Core: dotnet ef migrations add AddEventTypeFields
•	Verificar que AccountingDraft.EntryType sea consistente (o usar DebitAmount/CreditAmount, no ambos)

Fase 3 — Lógica Contable Correcta (~3 horas)
Objetivo: que TranslationService genere los asientos correctos para todos los tipos de eventos.

•	Refactorizar TranslationService.TranslateEventToDraftAsync usando la estructura de sección 3.3
•	Implementar los métodos auxiliares: BuildSimplePair, BuildTraslado, BuildCambioActividad, BuildCambioCategoria, BuildAjusteKg
•	RECUENTO debe retornar lista vacía sin crear asientos ni cambiar el status del evento
•	Agregar campo EntryType a MakeDraft helper con valores "DEBE" y "HABER"
•	Poblar HeadCount y WeightKg en cada AccountingDraft generado (no solo el importe monetario)
•	Agregar tests unitarios para cada tipo de evento verificando cantidad de drafts y tipos

Fase 4 — Balance y Mayor Correctos (~2 horas)
Objetivo: que los reportes reflejen los asientos contables, no los eventos directos.

•	Reemplazar la implementación de GetBalanceAsync según la query de sección 3.4
•	Extender BalanceItemDto con AccountCode, DebitTotal, CreditTotal y NetBalance
•	Actualizar el proto de ReportingService para exponer los nuevos campos del balance
•	Actualizar Balance.razor para bindear las nuevas columnas AccountCode y saldos
•	Verificar que el Mayor (GetLedgerAsync) ordene por EventDate (NodaTime Instant), no por CreatedAt
•	Conectar los filtros de fecha del Balance.razor al backend (actualmente son controles sueltos sin binding al gRPC)

Fase 5 — Sistema de Categorías CLIENTE/GESTOR (~2 horas)
Objetivo: que el Balance.razor pueda mostrar los datos agrupados por categorías normalizadas de Gestor Max.

•	Confirmar que CategoryType enum tiene valores Cliente y Gestor
•	Verificar que SyncCatalogService popule categorías con tipo Gestor desde la API
•	Implementar en ReportService el JOIN con CategoryMapping cuando categoryView == "gestor"
•	El toggle Cliente/Gestor en Balance.razor debe disparar FetchBalance con el nuevo parámetro

5. Checklist de Verificación por Fase
✓	Ítem a verificar	Fase
[ ]	dotnet build retorna 0 errores y 0 warnings	F1
[ ]	SyncCatalogService usa SystemClock.Instance.GetCurrentInstant()	F1
[ ]	EventType enum tiene los 12 valores correctos	F2
[ ]	LivestockEvent tiene DestinationFieldId, OriginCategoryId, DestinationCategoryId	F2
[ ]	Nueva migración de EF Core aplicada sin errores	F2
[ ]	NACIMIENTO genera 2 drafts: ACT001 DEBE + PN001 HABER	F3
[ ]	TRASLADO genera 2 drafts en ACT001 con campos distintos	F3
[ ]	RECUENTO genera 0 drafts	F3
[ ]	AJUSTE_KG negativo: RES008 DEBE, ACT001 HABER	F3
[ ]	AJUSTE_KG positivo: ACT001 DEBE, RES008 HABER	F3
[ ]	Todos los drafts tienen HeadCount y WeightKg poblados	F3
[ ]	GetBalanceAsync consulta AccountingDrafts (no LivestockEvents)	F4
[ ]	Balance muestra NetBalance = DebitTotal - CreditTotal por cuenta	F4
[ ]	Filtros de fecha en Balance.razor están conectados al gRPC	F4
[ ]	Toggle CLIENTE/GESTOR en Balance cambia la agrupación de categorías	F5

6. Apéndice — Mapa Completo de Asientos por Tipo de Evento
Referencia extraída de la función generateAsientos del prototipo TypeScript.

Tipo Evento	Cuenta DEBE	Cuenta HABER	Observación
Apertura	ACT001	PN001	Saldo inicial de hacienda
Nacimiento	ACT001	PN001	Incremento por cría propia
Destete	ACT001	PN001	Reclasificación destete
Compra	ACT001	RES002	Adquisición de hacienda
Venta	RES001	ACT001	Egresos por venta
Mortandad	RES003	ACT001	Pérdida por muerte
Consumo	RES004	ACT001	Consumo interno
Traslado	ACT001 (campo destino)	ACT001 (campo origen)	Mismo código, campos distintos
CambioActividad	ACT001 (act. destino)	ACT001 (act. origen)	Mismo código, actividades distintas
CambioCategoria	ACT001 (cat. destino)	ACT001 (cat. origen)	Mismo código, categorías distintas
AjusteKg (+)	ACT001	RES008	Ganancia de peso
AjusteKg (-)	RES008	ACT001	Pérdida de peso
Recuento	— (sin asientos)	— (sin asientos)	Solo informativo, no afecta stock

Nota: Los códigos de cuenta (ACT001, PN001, RES002, etc.) son los del prototipo. En producción, estos se resuelven dinámicamente desde el Plan de Cuentas del tenant sincronizado desde Gestor Max, usando los campos DebitAccountCode y CreditAccountCode del EventTemplate para los eventos simples.

7. Resumen de Prioridades
Ejecutar en este orden estricto para desbloquear el sistema:

•	INMEDIATO — Fase 1: corregir Instant.UtcNow → build verde
•	URGENTE — Fase 2: ampliar el dominio con los tipos de evento faltantes + migración
•	CORE — Fase 3: refactorizar TranslationService con lógica event-type-aware
•	CORE — Fase 4: corregir ReportService para que el balance use asientos
•	MEJORA — Fase 5: activar el sistema CLIENTE/GESTOR en los reportes

La arquitectura Clean Architecture del proyecto C# es sólida y no requiere cambios estructurales. Todos los cambios descriptos son modificaciones acotadas a archivos específicos sin impacto en la capa de infraestructura ni en el frontend Blazor.
