using GestorGanadero.Server.Application.DTOs;

namespace GestorGanadero.Server.Application.Interfaces;

public interface ILivestockEventService
{
    Task<Guid> CreateEventAsync(CreateLivestockEventRequest request);
    Task<IEnumerable<LivestockEventResponse>> GetPendingEventsAsync();
    Task<IEnumerable<EventTemplateDto>> GetEventTemplatesAsync(Guid tenantId);
    
    // Previous methods from earlier requirements (MVP)
    Task<string> CommitToErpAsync(IEnumerable<Guid> livestockEventIds);
    Task<LivestockEventDto> GetByIdAsync(Guid id);
    Task<IEnumerable<LivestockEventResponse>> GetEventsAsync(Guid? tenantId, DateTimeOffset? start, DateTimeOffset? end);
    Task<LivestockEventDetailDto> GetEventDetailsAsync(Guid id);
    Task UpdateEventAsync(UpdateEventRequestDto dto);
    Task DeleteEventAsync(Guid id);
}
