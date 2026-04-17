# Fase 1: MVP - Arquitectura e Implementación de Núcleo

## 1. Resumen de la Fase
La Fase 1 se centra en establecer el puente operativo entre el trabajo de campo ganadero y la gestión contable en **Gestor Max**. El objetivo es permitir el registro físico de eventos (nacimientos, destetes, etc.) y su traducción automática a asientos contables.

## 2. Módulos Core a Desarrollar

### Módulo 1: Autenticación y Multi-Tenant
*   **Identidad:** Implementación de JWT para sesiones seguras.
*   **Aislamiento:** Filtrado global por `TenantId` en todas las consultas de base de datos.
*   **UX:** Selector de Tenant en el Header de la aplicación Blazor.

### Módulo 2: Sincronización Entrante
*   **Catálogos:** Consumo de APIs de Gestor Max para sincronizar:
    *   Plan de Cuentas.
    *   Centros de Costo (Campos/Lotes).
    *   Categorías de Animales.
*   **Almacenamiento:** Uso de PostgreSQL con columnas **JSONB** para soportar estructuras de datos flexibles por cada cliente.

### Módulo 3: Configurador de Eventos (Traductor)
*   **Plantillas:** Interfaz para definir qué cuentas se debitan y acreditan por cada tipo de evento físico.
*   **Reglas de Imputación:** Lógica de negocio para transformar "Nacimiento de 10 Terneros" en un asiento contable cuadrado.

### Módulo 4: Registro Operativo Diario
*   **Formularios Blazor:** Uso de **Ant Design Blazor** para una carga de datos rápida y fluida.
*   **Validación:** Implementación de Data Annotations compartidas entre cliente y servidor.

### Módulo 5: Gateway de Salida (Validación y Sync)
*   **Borradores:** Grilla para auditar impactos contables antes de la sincronización final.
*   **Exportación:** Envío de asientos consolidados a la API de Gestor Max.

## 3. Especificaciones Técnicas (Stack .NET 10)

### Backend
*   **Arquitectura:** Clean Architecture (Domain, Application, Infrastructure, Api).
*   **Comunicación:** **gRPC-Web** para alta eficiencia en la comunicación binaria entre Blazor y el Servidor.
*   **Persistencia:** EF Core 10 con soporte nativo para **NodaTime** (precisión temporal y zonas horarias) y **PostGIS** (preparando Fase 3).

### Frontend (Blazor WebAssembly)
*   **UI System:** Ant Design Blazor con tema **"Antigravity"** (Dark Mode optimizado para baja fatiga visual).
*   **State Management:** Uso del atributo **`[PersistentState]`** de .NET 10 para evitar el parpadeo de UI al recargar o perder conexión.

## 4. Guía de Implementación del Tema Antigravity
Para habilitar el modo oscuro corporativo en Ant Design Blazor:
```razor
<ConfigProvider Theme="theme">
    <App />
</ConfigProvider>

@code {
    private GlobalTheme theme = new GlobalTheme {
        // Paleta Antigravity: Grises oscuros, Negro y Rojo Corporativo
        PrimaryColor = "#D32F2F", // Rojo Corporativo
        // Configuración de modo oscuro vía CSS Variables
    };
}
```

## 5. Próximos Pasos
1. Configurar el Scaffolding de la base de datos PostgreSQL.
2. Implementar los contratos gRPC en `GestorGanadero.Shared`.
3. Iniciar el desarrollo del Módulo de Autenticación.
