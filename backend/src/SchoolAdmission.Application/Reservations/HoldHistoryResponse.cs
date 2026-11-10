namespace SchoolAdmission.Application.Reservations;

public sealed record HoldHistoryResponse(
    string HoldId,
    string ClassId,
    string ClassName,
    string Status,
    DateTimeOffset ExpiresAt);
