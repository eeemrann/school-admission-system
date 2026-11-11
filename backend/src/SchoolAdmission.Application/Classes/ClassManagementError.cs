namespace SchoolAdmission.Application.Classes;

public enum ClassManagementErrorCode
{
    ValidationError,
    ClassNotFound,
    CapacityCannotDecrease
}

public sealed record ClassManagementError(
    ClassManagementErrorCode Code,
    string Detail,
    IReadOnlyDictionary<string, string[]>? Errors = null);
