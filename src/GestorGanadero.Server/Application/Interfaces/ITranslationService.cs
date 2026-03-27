using GestorGanadero.Server.Application.DTOs;

namespace GestorGanadero.Server.Application.Interfaces;

public interface ITranslationService
{
    /// <summary>
    /// TranslateEventToDraftAsync(LivestockEventId) -> Aplica la plantilla y genera el AccountingDraft.
    /// </summary>
    Task<IEnumerable<AccountingDraftDto>> TranslateEventToDraftAsync(Guid livestockEventId);
}
