Rol: Desarrollador Backend .NET 10 experto.

Tarea: Implementar la clase TranslationService que hereda de la interfaz ITranslationService. Esta es la lógica core del negocio.

Algoritmo estricto para TranslateEventToDraftAsync(Guid livestockEventId):

Buscar y Validar: >    * Buscar el LivestockEvent por ID en la base de datos, incluyendo (Include) su EventTemplate asociada.

Validar que el evento exista y que su Status sea Draft (Borrador). Si no, lanzar una InvalidOperationException.

Calcular Importes (Regla de Negocio Base V1):

Nota del arquitecto: Para la V1, asumiremos que el evento biológico ya trae un TotalAmount (Monto Valorizado) calculado desde el front o desde un paso previo, o si es puramente físico, el monto es 0 pero se registran cabezas/kilos.

Generar el Asiento del DEBE (Debit):

Crear una nueva entidad AccountingDraft.

Asignar el LivestockEventId.

Obtener la cuenta del DEBE desde la plantilla: AccountCode = eventEntity.EventTemplate.DebitAccountCode.

Concepto: "Ref: [NombrePlantilla] - Lote: [CostCenterCode] - Cabezas: [HeadCount]".

Setear DebitAmount = TotalAmount y CreditAmount = 0.

Generar el Asiento del HABER (Credit):

Crear una segunda entidad AccountingDraft.

Asignar el LivestockEventId.

Obtener la cuenta del HABER desde la plantilla: AccountCode = eventEntity.EventTemplate.CreditAccountCode.

Concepto: El mismo que el DEBE.

Setear DebitAmount = 0 y CreditAmount = TotalAmount.

Persistir y Mapear:

Guardar ambos borradores en el DbContext (agregarlos al DbSet<AccountingDraft>).

Cambiar el Status del LivestockEvent a Validated.

Llamar a await _context.SaveChangesAsync().

Mapear las entidades AccountingDraft a AccountingDraftDto y retornarlas.

Por favor, escribe el código de TranslationService.cs utilizando Inyección de Dependencias (inyectando el GestorGanaderoDbContext o el Repositorio correspondiente) y manejo asíncrono.