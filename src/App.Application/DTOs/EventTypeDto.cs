namespace App.Application.DTOs;

public record EventTypeDto(
    Guid Id,
    string Code,
    string Name,
    string DebitAccountCode,
    string CreditAccountCode,
    bool RequiresOriginDestination,
    bool RequiresDestinationField,
    bool IsActive,
    Guid TenantId,
    List<Guid>? ActivityIds = null
);