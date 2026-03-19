using WebApplication1.Application.DTOs;

namespace WebApplication1.Application.Interfaces;

public interface ITranslationService
{
    /// <summary>
    /// TranslateEventToDraftAsync(LivestockEventId) -> Aplica la plantilla y genera el AccountingDraft.
    /// </summary>
    Task<IEnumerable<AccountingDraftDto>> TranslateEventToDraftAsync(Guid livestockEventId);
}
