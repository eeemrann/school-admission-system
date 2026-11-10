using SchoolAdmission.Domain.Enums;

namespace SchoolAdmission.Application.Reservations;

public sealed record HoldHistoryItem(
    Guid HoldId,
    Guid ClassId,
    string ClassName,
    HoldStatus Status,
    DateTimeOffset ExpiresAt);
