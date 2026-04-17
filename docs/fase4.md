# Fase 4: Analítica Zootécnica y Simulación de Rendimiento

## 1. Resumen de la Fase
La Fase 4 marca la transición de un sistema de registro a un sistema de soporte de decisiones (DSS). El objetivo es utilizar la riqueza de datos acumulada en las fases anteriores (pesajes, categorías, nutrición por lote) para proyectar el crecimiento de la hacienda y optimizar la ventana de comercialización mediante modelos predictivos.

## 2. Proyección de Ganancia Diaria (ADG)

### Motor de Machine Learning (ML.NET)
Implementación de modelos de series de tiempo utilizando el algoritmo **SSA (Singular Spectrum Analysis)** para predecir la evolución del peso de los animales:
*   **Factores de Entrada:** Historial de pesajes por individuo/rodeo, categoría biológica, actividad productiva y calidad nutricional del lote (derivada del historial de rotación en SIG).
*   **Predicción de Confianza:** Generación de intervalos de confianza (Upper/Lower bounds) para manejar la incertidumbre biológica.

### Detección de Anomalías
Uso de **SR-CNN (Spectral Residual CNN)** para identificar desviaciones críticas en el crecimiento:
*   Alertas automáticas ante caídas inesperadas de peso que puedan indicar problemas sanitarios o deficiencias en la pastura.

## 3. Simulación Económica y Escenarios "What-If"

### Integración con Precios de Mercado
Cruce de las proyecciones de peso con los precios dinámicos sincronizados desde **Gestor Max** o plataformas de mercado asociadas:
*   **Cálculo de Margen Proyectado:** Estimación del valor futuro del stock basado en la curva de crecimiento y tendencias de precios.
*   **Optimización de Ventas:** Herramienta para comparar el retorno económico de vender hoy vs. mantener los animales 30, 60 o 90 días adicionales (ajustando por costos de mantenimiento).

## 4. Analítica de Eficiencia por Lote
*   **Conversión Alimenticia:** Relación entre el tiempo de permanencia en un lote (SIG) y la ganancia de peso registrada.
*   **Ranking de Productividad:** Identificación de los lotes y categorías con mejor rendimiento zootécnico dentro del establecimiento.

## 5. Especificaciones Técnicas

### Stack de Datos
*   **Framework:** ML.NET (Microsoft.ML.TimeSeries).
*   **Modelado:** SsaForecasting para proyecciones multivariadas.
*   **Visualización:** Gráficos interactivos en Blazor (Ant Design Charts) para mostrar curvas de crecimiento proyectado vs. real.

## 6. Checklist de Implementación
- [ ] Integración de la librería `Microsoft.ML` en el proyecto de aplicación.
- [ ] Implementación del servicio de analítica de pesajes históricos.
- [ ] Desarrollo del simulador de escenarios económicos "vender vs. retener".
- [ ] Creación de alertas de anomalías en el crecimiento animal.
- [ ] Dashboard de indicadores zootécnicos (ADG, Carga Animal, Eficiencia).
