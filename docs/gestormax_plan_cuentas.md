# Integración de Plan de Cuentas (GestorMax API vs Gestión Local)

Este documento resume el análisis realizado sobre la conveniencia de integrar el **Plan de Cuentas** directamente desde la API del ERP GestorMax (`ListPlanesDeCuentas` y `ListPlanDeCuentasCuentas`) frente a la alternativa de mantener un Plan de Cuentas interno e independiente en **GestorGanadero**.

## 1. El Problema

El módulo ganadero requiere que los usuarios configuren "Cuentas Contables" para cada Tipo de Evento (ej. cuenta de debe y haber para un Nacimiento o una Mortandad). El debate principal es si esas cuentas deben ser consultadas e importadas directamente y en tiempo real desde el ERP, o si el módulo debe contar con su propio ABM (Alta, Baja, Modificación) de cuentas.

## 2. Desventajas de la Integración Directa (API)

*   **Complejidad del Árbol Contable:** 
    La API de GestorMax devuelve la totalidad del árbol contable, incluyendo cuentas "Sumarias" (carpetas o agrupadores) y cuentas de "Asiento" (imputables). Si exponemos todo el árbol en la UI de GestorGanadero, obligamos a implementar lógica de filtrado compleja en el frontend para evitar que el usuario asigne un evento ganadero a una cuenta sumaria.
*   **Ausencia de Naturaleza Contable Explícita:** 
    Los DTOs de GestorMax devuelven atributos como `tipoCuenta` y jerarquías, pero no especifican de forma directa y tipada la naturaleza contable (Activo, Pasivo, Resultado / Deudora, Acreedora). Para que los tableros de control (como `Balance.razor`) funcionen correctamente, tendríamos que inferir esto a partir del primer dígito del código de la cuenta (ej. `1` = Activo, `4` = Resultado), una práctica frágil si el contador del cliente estructuró el plan de forma no estándar.
*   **Dependencia y Bloqueo de Standalone:** 
    Acoplar fuertemente el alta de cuentas a la API de GestorMax impide que `GestorGanadero` se pueda comercializar o utilizar de manera aislada (standalone). El sistema no funcionaría hasta que no se configure una conexión exitosa con la base de datos del ERP.
*   **Sobrecarga Cognitiva:** 
    El plan de cuentas del ERP suele ser masivo y contener rubros irrelevantes para el módulo ganadero (Cajas, Bancos, Deudas Fiscales, etc.). Obligar al operario del campo a navegar por todo el plan de cuentas del ERP para configurar un evento genera fricción.

## 3. Recomendación Estratégica: Modelo Híbrido

Para sortear los problemas mencionados, se recomienda implementar un **Modelo Híbrido** o de **Plan de Cuentas Interno Mapeable**.

1.  **Plan de Cuentas Interno (Fase 1):**
    GestorGanadero debe tener su propio maestro de cuentas, sumamente simplificado. Por ejemplo, al crear un nuevo cliente o *Tenant*, el sistema puede sembrar automáticamente un "Plan de Cuentas Ganadero Estándar" (ej: *Hacienda Bovinos*, *Diferencia de Inventario*, *Gastos de Sanidad*). Esto permite que la aplicación funcione de forma 100% independiente y veloz.
2.  **Mapeo contra el ERP (Fase 2):**
    A las entidades locales de la cuenta (`Account.cs`) se les agregará un campo `ErpAccountId` (o `ErpAccountCode`). Cuando la empresa decida encender la "Sincronización con GestorMax", el administrador del sistema podrá ingresar a una pantalla de homologación para mapear sus "Cuentas Internas" con los "Códigos de Cuenta del ERP".
    De esta forma, cuando se genere un asiento contable, el backend de GestorGanadero sabrá exactamente a qué código de cuenta en GestorMax debe impactar el movimiento, sin haber arrastrado la complejidad del ERP a la interfaz del usuario.

## 4. Estructuras Técnicas (Referencia Futura)

Si en el futuro se decide avanzar con la lectura de las cuentas del ERP para facilitar el mapeo, estos son los DTOs y modelos que se utilizarán:

### DTOs de Integración
```csharp
public class GestorMaxPlanCuentaDto
{
    public string CodPlan { get; set; } = string.Empty;
    public string Plan { get; set; } = string.Empty;
    public string CodTipoPlan { get; set; } = string.Empty;
    public bool Habilitado { get; set; }
}

public class GestorMaxCuentaDto
{
    public string CodPlan { get; set; } = string.Empty;
    public string CodCuenta { get; set; } = string.Empty;       // ID interno GestorMax
    public string CodigoCuenta { get; set; } = string.Empty;    // Código Jerárquico (ej: 11101000)
    public string Cuenta { get; set; } = string.Empty;          // Nombre de la cuenta
    public string CodTipoCuenta { get; set; } = string.Empty;
    public string TipoCuenta { get; set; } = string.Empty;      // ej: "Sumaria Patrimonial", "Asiento Patrimonial..."
    public long? CodSumaria { get; set; }
    public bool Habilitado { get; set; }
    public string? Moneda { get; set; }
    
    // Helper para saber si la cuenta recibe asientos
    public bool EsImputable => TipoCuenta != null && TipoCuenta.StartsWith("Asiento");
}
```

### Modificaciones en la Entidad `Account`
```csharp
public class Account : BaseAuditableEntity
{
    public Guid TenantId { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public Guid PlanId { get; set; }
    
    public NormalType NormalType { get; set; }
    public string AccountGroup { get; set; } = "ACTIVO"; 
    
    public bool IsActive { get; set; } = true;
    public bool IsImputable { get; set; } = true;
    
    // ---- Mapeo Opcional con ERP GestorMax ----
    public string? ErpAccountId { get; set; } // Referencia al "codCuenta" de GestorMax
    public long? ErpParentId { get; set; }    
    
    public Tenant? Tenant { get; set; }
    public PlanCuenta? Plan { get; set; }
}
```
