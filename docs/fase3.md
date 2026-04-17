# Fase 3: Inteligencia Espacial y Geofencing

## 1. Resumen de la Fase
La Fase 3 transforma el **Gestor Ganadero** de una herramienta administrativa a un sistema inteligente de gestión territorial. Se centra en la implementación de capacidades SIG (Sistema de Información Geográfica) para la delimitación de lotes, monitoreo de cargas animales y análisis de rotación de pasturas utilizando **PostGIS** y **NetTopologySuite**.

## 2. Infraestructura Geoespacial

### Configuración de NetTopologySuite
Integración de la librería líder en .NET para el manejo de geometrías conforme al estándar OpenGIS:
*   **SRID 4326:** Estandarización de todas las coordenadas en WGS 84 (GPS).
*   **EF Core Integration:** Uso de `HasPostgresExtension("postgis")` y tipos de datos `Geometry` o `Polygon` en las entidades de base de datos.

### Entidades Espaciales
*   **Lotes (Polígonos):** Almacenamiento de la geometría exacta de cada lote del establecimiento.
*   **Puntos de Interés:** Marcación de aguadas, mangas y corrales.

## 3. Capacidades de Geofencing y Análisis

### Consultas Espaciales Proactivas
Implementación de lógica de negocio basada en ubicación física:
*   **ST_DWithin:** Cálculo de proximidad para alertas de animales cerca de perímetros o aguadas.
*   **ST_Contains / Intersects:** Validación automática de movimientos de hacienda basados en la ubicación reportada por el dispositivo móvil.

### Cálculo de Carga Animal (Stocking Rate)
*   **Densidad Dinámica:** Cálculo automático de la relación "Cabezas/Hectárea" o "EV (Equivalente Vaca)/Hectárea" cruzando la superficie del polígono del lote con el stock actual derivado de los `AccountingDrafts`.
*   **Mapa de Calor:** Visualización de la intensidad de pastoreo por lote para optimizar el descanso de las pasturas.

## 4. Interfaz de Mapas (Frontend)

### Integración con Leaflet / Ant Design
*   **Modo Dibujo:** Herramientas para que el usuario pueda delimitar sus lotes directamente sobre el mapa (Soporte GeoJSON).
*   **Capas de Visualización:**
    *   Capa de Catastro (Lotes y superficies).
    *   Capa Operativa (Ubicación actual de los rodeos).
    *   Capa de Infraestructura (Cercos, bebederos).

### Tema Visual SIG
*   **Dark Mode Map:** Estilización del mapa para que sea coherente con el tema **Antigravity** de la aplicación, minimizando el impacto visual en condiciones de poca luz.

## 5. Roadmap de Implementación
- [ ] Habilitar extensión PostGIS en PostgreSQL.
- [ ] Agregar campo `Geometria` (Polygon) a la entidad `Lote`.
- [ ] Implementar `LoteService` con validaciones de superficie y superposición.
- [ ] Desarrollar el componente `Mapas.razor` con Leaflet.js.
- [ ] Crear el reporte de Carga Animal basado en geometrías reales.
