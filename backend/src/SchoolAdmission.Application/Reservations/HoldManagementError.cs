namespace SchoolAdmission.Application.Reservations;

public enum HoldManagementErrorCode
{
    ValidationError,
    StudentIdRequired,
    ClassNotFound,
    HoldNotFound,
    DuplicateActiveApplication,
    NoSeatsAvailable
}

public sealed record HoldManagementError(
    HoldManagementErrorCode Code,
    string Detail,
    IReadOnlyDictionary<string, string[]>? Errors = null);
