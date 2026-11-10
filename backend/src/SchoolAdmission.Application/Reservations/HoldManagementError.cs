namespace SchoolAdmission.Application.Reservations;

public enum HoldManagementErrorCode
{
    ValidationError,
    StudentIdRequired,
    ClassNotFound,
    HoldNotFound,
    HoldOwnerForbidden,
    DuplicateActiveApplication,
    NoSeatsAvailable,
    HoldExpired,
    HoldCancelled,
    ConfirmedHoldCannotCancel
}

public sealed record HoldManagementError(
    HoldManagementErrorCode Code,
    string Detail,
    IReadOnlyDictionary<string, string[]>? Errors = null);
