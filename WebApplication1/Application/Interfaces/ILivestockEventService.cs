using WebApplication1.Application.DTOs;

namespace WebApplication1.Application.Interfaces;

public interface ILivestockEventService
{
    Task<Guid> CreateEventAsync(CreateLivestockEventRequest request);
    Task<IEnumerable<LivestockEventResponse>> GetPendingEventsAsync();
    
    // Previous methods from earlier requirements (MVP)
    Task<string> CommitToErpAsync(IEnumerable<Guid> livestockEventIds);
    Task<LivestockEventDto> GetByIdAsync(Guid id);
    Task<IEnumerable<LivestockEventDto>> GetAllAsync(Guid tenantId);
    Task UpdateAsync(LivestockEventDto dto);
    Task DeleteAsync(Guid id);
}
