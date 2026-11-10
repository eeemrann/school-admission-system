namespace SchoolAdmission.Application.Reservations;

public sealed record HoldDetailsResponse(
    string HoldId,
    string ClassId,
    string Status,
    DateTimeOffset ExpiresAt);
