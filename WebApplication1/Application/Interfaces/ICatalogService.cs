using WebApplication1.Application.DTOs;

namespace WebApplication1.Application.Interfaces;

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
}
