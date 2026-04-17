Resumen de Issues Priorizados
Prioridad          Problema          Archivo
🔴 AltaGetBalanceAsync no filtra por TenantId explícito (depende del query filter global, riesgo si el contexto HTTP no está disponible en gRPC)ReportService.cs
🔴 AltaVerificar que el flujo Evento → Traducción → Draft esté siendo ejecutado (sin drafts el balance siempre vacío)Flujo de negocio
🟡 MediaGetBalanceAsync agrupa en memoria en vez de en SQLReportService.cs
🟡 MediaBuildTraslado pasa heads (int) como importe monetario en MakeDraftTranslationService.cs
🟡 MediaAnimalCategory.LastSyncedAt usa DateTimeOffset en vez de NodaTimeSyncCatalogService.cs
🟢 BajaInconsistencia Cliente vs Client en CategoryType enumCategoryType.cs
🟢 Bajareview_fase_5.txt desactualizado (dice que la lógica gestor no está, pero sí está)Documentación