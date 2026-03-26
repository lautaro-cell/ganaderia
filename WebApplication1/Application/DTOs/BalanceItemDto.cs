namespace WebApplication1.Application.DTOs;

public record BalanceItemDto(
    string FieldName,
    string CategoryName,
    int HeadCount,
    decimal TotalWeight,
    string ActivityName);
