using App.Application.DTOs;

namespace App.Application.Interfaces;

public interface ITranslationService
{
    /// <summary>
    /// TranslateEventToDraftAsync(LivestockEventId) -> Aplica la plantilla y genera el AccountingDraft.
    /// </summary>
    Task<IEnumerable<AccountingDraftDto>> TranslateEventToDraftAsync(Guid livestockEventId);
}

