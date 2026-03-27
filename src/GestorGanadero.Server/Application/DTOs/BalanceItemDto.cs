namespace GestorGanadero.Server.Application.DTOs;

public record BalanceItemDto(
    string FieldName,
    string CategoryName,
    int HeadCount,
    decimal TotalWeight,
    string ActivityName);
