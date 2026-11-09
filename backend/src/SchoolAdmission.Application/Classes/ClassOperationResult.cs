namespace SchoolAdmission.Application.Classes;

public sealed record ClassOperationResult<T>(
    T? Value,
    ClassManagementError? Error)
{
    public bool IsSuccess => Error is null;
}
