# Fase 2: Dominio Completo e Integración Operativa

## 1. Resumen de la Fase
La Fase 2 expande el alcance del sistema para cubrir el 100% de los eventos operativos detectados en el análisis del prototipo. Se enfoca en la robustez del modelo de dominio, la precisión de la lógica contable y el inicio de la evolución hacia una aplicación **PWA (Progressive Web App)** con capacidades de trabajo desconectado.

## 2. Ampliación del Modelo de Dominio

### Eventos Ganaderos Extendidos
Se actualiza el enumerador `EventType` para incluir 12 tipos de eventos críticos:
*   **Apertura:** Saldo inicial de hacienda.
*   **Destete:** Reclasificación operativa.
*   **Mortandad / Consumo:** Egreso por motivos no comerciales.
*   **Traslado:** Movimiento físico entre campos (Mismo código de cuenta, distinto Centro de Costo).
*   **Cambio de Actividad / Categoría:** Reclasificación biológica.
*   **Ajuste de Kg:** Sincronización de peso físico vs contable.
*   **Recuento:** Evento informativo que no genera asientos contables.

### Nuevos Campos en LivestockEvent
Para soportar la lógica de traslados y cambios, se incorporan:
*   `DestinationFieldId`: Identificador del campo de destino.
*   `OriginCategoryId` / `DestinationCategoryId`: Para trazabilidad de reclasificación biológica.
*   `OriginActivityId` / `DestinationActivityId`: Para trazabilidad de cambios de actividad.

## 3. Lógica Contable Avanzada (TranslationService)
Refactorización del motor de traducción para manejar eventos con lógica especial:
*   **Lógica de Traslado:** Generación de un par de asientos (Debe/Haber) que cruzan los campos de origen y destino manteniendo la misma cuenta de activo.
*   **Ajuste de Peso:** Lógica condicional basada en el signo del ajuste (Ganancia vs Pérdida).
*   **Metadatos Físicos:** Inyección obligatoria de **Cabezas** y **Kg** en cada registro de `AccountingDraft` para permitir reportes de stock físico-contable.

## 4. Sistema de Categorías Dual (Cliente/Gestor)
Implementación de un sistema de mapeo de categorías para satisfacer tanto la operatividad como el reporting consolidado:
*   **Nivel Cliente:** Categorías personalizadas del establecimiento (ej: "Terneras de Invernada").
*   **Nivel Gestor:** Categorías normalizadas de Gestor Max (ej: "Terneras < 150kg").
*   **Reporting:** Capacidad de alternar la vista del Balance entre ambos niveles mediante JOINs dinámicos con `CategoryMapping`.

## 5. Evolución Tecnológica: PWA y Offline
Sentar las bases para el trabajo de campo sin conexión:
*   **Configuración PWA:** Activación de Service Workers y Manifest para instalación en dispositivos móviles.
*   **SQLite WASM:** Preparación de la infraestructura en Blazor para utilizar SQLite en el navegador mediante **OPFS (Origin Private File System)**.
*   **Sincronización:** Diseño del patrón de sincronización de eventos pendientes cuando se recupera la conexión.

## 6. Checklist de Implementación
- [ ] Ampliación del enum `EventType`.
- [ ] Migración de base de datos para nuevos campos de `LivestockEvent`.
- [ ] Refactorización de `TranslationService` para tipos de eventos especiales.
- [ ] Implementación de lógica Cliente/Gestor en `ReportService`.
- [ ] Configuración inicial de manifiesto PWA en `GestorGanadero.Client`.
