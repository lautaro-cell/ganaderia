using Microsoft.Extensions.Logging;
using App.Domain.Entities;

namespace App.Domain.Services;

/// <summary>
/// Motor de reglas contables.
/// Migra la función 'generateAsientos' del sistema Node.js original.
/// Genera automáticamente los asientos de partida doble a partir del tipo de evento.
/// </summary>
public class AccountingEntryGenerator
{
    private readonly ILogger<AccountingEntryGenerator> _logger;

    /// <summary>
    /// Mapa de reglas contables por tipo de evento (código).
    /// Migrado directamente de Node.js: asientoMap.
    /// </summary>
    private static readonly Dictionary<string, (string DebitAccount, string CreditAccount)> AccountingRules = new()
    {
        ["APERTURA"]   = ("ACT001", "PN001"),
        ["NACIMIENTO"] = ("ACT001", "PN001"),
        ["DESTETE"]    = ("ACT001", "PN001"),
        ["COMPRA"]     = ("ACT001", "RES002"),
        ["VENTA"]      = ("RES001", "ACT001"),
        ["MORTANDAD"]  = ("RES003", "ACT001"),
        ["CONSUMO"]    = ("RES004", "ACT001"),
    };

    public AccountingEntryGenerator(ILogger<AccountingEntryGenerator> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Genera los asientos contables para un evento dado.
    /// Retorna una lista de AccountingDraft (sin persistir).
    /// </summary>
    public Result<IEnumerable<AccountingDraft>> GenerateEntries(
        LivestockEvent evt,
        string eventTypeCode,
        string concept)
    {
        _logger.LogInformation("Generating accounting entries for event {EventId} of type {EventType}", evt.Id, eventTypeCode);

        var drafts = new List<AccountingDraft>();
        var code = eventTypeCode.ToUpperInvariant();

        switch (code)
        {
            // --- Standard events (simple debit/credit) ---
            case "APERTURA":
            case "NACIMIENTO":
            case "DESTETE":
            case "COMPRA":
            case "VENTA":
            case "MORTANDAD":
            case "CONSUMO":
            {
                if (!AccountingRules.TryGetValue(code, out var rule))
                    return Result<IEnumerable<AccountingDraft>>.Failure($"Sin regla contable para el tipo '{code}'.");

                drafts.Add(BuildEntry(evt, concept, rule.DebitAccount, "DEBE"));
                drafts.Add(BuildEntry(evt, concept, rule.CreditAccount, "HABER"));
                break;
            }

            // --- Category transfer: two ACT001 entries (origin/destination) ---
            case "CAMBIO_CATEGORIA":
            case "CAMBIO_ACTIVIDAD":
            {
                if (evt.CategoryId == null)
                    return Result<IEnumerable<AccountingDraft>>.Failure("CAMBIO_CATEGORIA requiere CategoryId de origen y destino.");

                drafts.Add(BuildEntry(evt, concept, "ACT001", "DEBE", isDestination: true));
                drafts.Add(BuildEntry(evt, concept, "ACT001", "HABER", isOrigin: true));
                break;
            }

            // --- Field transfer ---
            case "TRASLADO":
            {
                drafts.Add(BuildEntry(evt, concept, "ACT001", "DEBE"));
                drafts.Add(BuildEntry(evt, concept, "ACT001", "HABER", isOrigin: true));
                break;
            }

            // --- Kg adjustment (no head movement) ---
            case "AJUSTE_KG":
            {
                var absKg = Math.Abs(evt.EstimatedWeightKg);
                if (evt.EstimatedWeightKg >= 0)
                {
                    drafts.Add(BuildEntry(evt, concept, "ACT001", "DEBE",  overrideHeadCount: 0, overrideWeightKg: absKg));
                    drafts.Add(BuildEntry(evt, concept, "RES008", "HABER", overrideHeadCount: 0, overrideWeightKg: absKg));
                }
                else
                {
                    drafts.Add(BuildEntry(evt, concept, "RES008", "DEBE",  overrideHeadCount: 0, overrideWeightKg: absKg));
                    drafts.Add(BuildEntry(evt, concept, "ACT001", "HABER", overrideHeadCount: 0, overrideWeightKg: absKg));
                }
                break;
            }

            // --- Inventory count (informational only, no accounting entries) ---
            case "RECUENTO":
                _logger.LogInformation("RECUENTO event {EventId}: no accounting entries generated (informational only).", evt.Id);
                break;

            // --- Fallback for template-based events ---
            default:
            {
                _logger.LogWarning("No hardcoded rule for '{Code}'. Falling back to template accounts.", code);
                drafts.Add(BuildEntry(evt, concept, "ACT001", "DEBE"));
                drafts.Add(BuildEntry(evt, concept, "PN002",  "HABER"));
                break;
            }
        }

        return Result<IEnumerable<AccountingDraft>>.Success(drafts);
    }

    private AccountingDraft BuildEntry(
        LivestockEvent evt,
        string concept,
        string accountCode,
        string entryType,
        bool isOrigin = false,
        bool isDestination = false,
        int? overrideHeadCount = null,
        decimal? overrideWeightKg = null)
    {
        return new AccountingDraft
        {
            TenantId        = evt.TenantId,
            LivestockEventId = evt.Id,
            AccountCode     = accountCode,
            Concept         = concept,
            EntryType       = entryType,
            DebitAmount     = entryType == "DEBE"  ? evt.TotalAmount : 0,
            CreditAmount    = entryType == "HABER" ? evt.TotalAmount : 0,
            HeadCount       = overrideHeadCount ?? evt.HeadCount,
            WeightKg        = overrideWeightKg  ?? evt.EstimatedWeightKg,
            WeightPerHead   = evt.WeightPerHead,
            FieldId         = evt.FieldId
        };
    }
}

/// <summary>Simple Result Pattern to avoid throwing exceptions in domain logic.</summary>
public class Result<T>
{
    public bool IsSuccess { get; }
    public T? Value { get; }
    public string? ErrorMessage { get; }

    private Result(bool success, T? value, string? error)
    {
        IsSuccess    = success;
        Value        = value;
        ErrorMessage = error;
    }

    public static Result<T> Success(T value)      => new(true, value, null);
    public static Result<T> Failure(string error) => new(false, default, error);
}

