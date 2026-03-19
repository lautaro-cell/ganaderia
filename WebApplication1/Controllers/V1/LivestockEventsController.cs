using Microsoft.AspNetCore.Mvc;
using WebApplication1.Application.DTOs;
using WebApplication1.Application.Interfaces;

namespace WebApplication1.Controllers.V1;

[ApiController]
[Route("api/v1/[controller]")]
public class LivestockEventsController : ControllerBase
{
    private readonly ITranslationService _translationService;
    private readonly ILivestockEventService _livestockEventService;

    public LivestockEventsController(ITranslationService translationService, ILivestockEventService livestockEventService)
    {
        _translationService = translationService;
        _livestockEventService = livestockEventService;
    }

    [HttpPost]
    public async Task<ActionResult> Create(CreateLivestockEventRequest request)
    {
        try
        {
            var newId = await _livestockEventService.CreateEventAsync(request);
            // Respuesta RESTful: 201 Created con un objeto JSON simple con el ID generado
            return Created(string.Empty, new { id = newId });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An unexpected error occurred.", details = ex.Message });
        }
    }

    [HttpGet("pending")]
    public async Task<ActionResult<IEnumerable<LivestockEventResponse>>> GetPending()
    {
        var pendingEvents = await _livestockEventService.GetPendingEventsAsync();
        return Ok(pendingEvents);
    }

    [HttpPost("{id:guid}/translate")]
    public async Task<ActionResult<IEnumerable<AccountingDraftDto>>> Translate(Guid id)
    {
        try
        {
            var drafts = await _translationService.TranslateEventToDraftAsync(id);
            return Ok(drafts);
        }
        catch (InvalidOperationException ex)
        {
            // Manejo de errores de lógica de negocio (ej: evento no encontrado o en estado inválido)
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            // Errores inesperados
            return StatusCode(500, new { message = "An unexpected error occurred.", details = ex.Message });
        }
    }
}
