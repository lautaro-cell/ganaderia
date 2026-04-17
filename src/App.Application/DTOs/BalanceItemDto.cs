namespace App.Application.DTOs;

public record BalanceItemDto(
    string FieldName,
    string CategoryName,
    int HeadCount,
    decimal TotalWeight,
    string ActivityName,
    string AccountCode,
    decimal DebitTotal,
    decimal CreditTotal,
    decimal NetBalance);

