# Índice de módulos — Plan Estratégico de Mejoras Gestor Ganadero

Versión base: 1.0  
Fecha del plan original: 2026-04-24  
Stack actual: ANALIZALO 

## Objetivo

Dividir el plan estratégico de mejoras en archivos Markdown independientes para que cada módulo pueda ser desarrollado, probado y revisado por un agente de desarrollo con menor ambigüedad.

## Orden recomendado de ejecución

1. `MODULO2.md` (Módulo 1: Motor Contable)  
   Eliminar cuentas hardcodeadas, parametrizar imputaciones y validar DEBE = HABER.

2. `MODULO3.md` (Módulo 2: Modal de Carga de Eventos)  
   Mejorar el modal de carga de eventos, cascada de selección, guardado correcto y preview de asiento.

3. `MODULO4.md` (Módulo 3: Mayor Contable)  
   Corregir endpoint, filtros, visualización y exportación CSV del mayor.

4. `MODULO5.MD` (Módulo 4: Balance Contable)  
   Implementar jerarquía PLAN → CAMPO → CATEGORÍA, subtotales y modo Mes/Acumulado.

5. `MODULO6.MD` (Módulo 5: Admin Campos Sin GIS)  
   Quitar campos GIS no operativos del alta/edición de campos.

6. `MODULO7.MD` (Módulo 6: Integración Gestor Max)  
   Agregar verificación de conexión y estado visible de integración con Gestor Max.

## Reglas generales para todos los agentes

- No modificar módulos fuera del alcance salvo que sea estrictamente necesario.
- Mantener compatibilidad con el stack actual: Node.js / Express, PostgreSQL y Vanilla JS SPA.
- No introducir frameworks frontend nuevos.
- No cambiar nombres de tablas o columnas existentes sin migración explícita.
- Todo cambio de base de datos debe tener SQL claro, reversible y comentado.
- Validar manualmente los flujos afectados antes de dar el módulo por terminado.
- No ocultar errores técnicos con mensajes genéricos. Los errores deben ser legibles y diagnósticables.
- Mantener la lógica multi-tenant usando `req.activeTenantId` o el mecanismo existente del repositorio.

## Archivos esperados del repositorio

- `index.js`
- `public/index.html`
- `public/script.js`
- Migraciones SQL o scripts equivalentes del proyecto
- `db/seed.sql` si existe y contiene cuentas contables base

## Nota crítica

El módulo 1 debe ejecutarse antes que los demás si hay despliegue integral, porque modifica la generación contable y puede bloquear el guardado de eventos si las cuentas no están configuradas.
