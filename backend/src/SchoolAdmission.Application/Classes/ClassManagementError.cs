namespace SchoolAdmission.Application.Classes;

public enum ClassManagementErrorCode
{
    ValidationError,
    ClassNotFound
}

public sealed record ClassManagementError(
    ClassManagementErrorCode Code,
    string Detail,
    IReadOnlyDictionary<string, string[]>? Errors = null);
