---
name: net10-verification
description: |-
  Verifica automáticamente todo el código generado o refactorizado en .NET 10 contra la documentación oficial de Context7.
  Debe utilizarse antes de aplicar cambios para asegurar el cumplimiento de las mejores prácticas, sintaxis correcta y uso de librerías actualizadas.
---

# Protocolo de Verificación de Skill: .NET 10

Cuando realices tareas que involucren código C#/.NET 10, sigue estrictamente este flujo de trabajo:

1. **Identificación de Librerías/Frameworks:**
   - Lista todas las APIs, librerías o frameworks utilizados en tu propuesta de código.
   - Si no estás seguro de la sintaxis actual, usa `resolve-library-id` para obtener el ID correcto.

2. **Verificación de Documentación:**
   - Para cada componente clave, invoca `context7_query-docs` utilizando el ID de librería obtenido.
   - Compara la sintaxis propuesta con los ejemplos oficiales para asegurar que no estás utilizando APIs obsoletas o patrones antiguos.

3. **Validación:**
   - **Antes de escribir:** Si detectas discrepancias entre tu código y la documentación, ajusta el código *antes* de realizar el `write` o `edit` en el proyecto.
   - **Después de escribir:** Si la tarea es crítica, verifica una vez más con la herramienta de búsqueda de docs.

4. **Reporte:**
   - En tu respuesta, menciona explícitamente: "Verificado con Context7 para .NET 10" si el código fue validado.
   - Si hay ambigüedades, informa al usuario antes de proceder.
