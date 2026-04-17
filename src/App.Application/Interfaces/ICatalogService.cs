using App.Application.DTOs;

namespace App.Application.Interfaces;

public interface ICatalogService
{
    // Fields
    Task<IEnumerable<FieldDto>> GetFieldsAsync();
    Task<Guid> CreateFieldAsync(FieldDto dto);
    Task UpdateFieldAsync(FieldDto dto);
    Task DeleteFieldAsync(Guid id);

    // Activities
    Task<IEnumerable<ActivityDto>> GetActivitiesAsync();
    Task<Guid> CreateActivityAsync(ActivityDto dto);
    Task UpdateActivityAsync(ActivityDto dto);
    Task DeleteActivityAsync(Guid id);

    // Categories
    Task<IEnumerable<AnimalCategoryDto>> GetCategoriesAsync();
    Task<Guid> CreateCategoryAsync(AnimalCategoryDto dto);
    Task UpdateCategoryAsync(AnimalCategoryDto dto);
    Task DeleteCategoryAsync(Guid id);

    // Mappings
    Task<IEnumerable<CategoryMappingDto>> GetMappingsAsync(Guid tenantId);
    Task AddMappingAsync(CategoryMappingDto dto);
    Task DeleteMappingAsync(Guid categoriaClienteId, Guid tenantId);

    // Event Types
    Task<IEnumerable<EventTypeDto>> GetEventTypesAsync(Guid tenantId);
    Task<Guid> CreateEventTypeAsync(EventTypeDto dto);
    Task UpdateEventTypeAsync(EventTypeDto dto);
    Task DeleteEventTypeAsync(Guid id);

    // Accounts
    Task<IEnumerable<AccountDto>> GetAccountsAsync(Guid tenantId);
    Task<Guid> CreateAccountAsync(AccountDto dto);
    Task UpdateAccountAsync(AccountDto dto);
    Task DeleteAccountAsync(Guid id);
}

