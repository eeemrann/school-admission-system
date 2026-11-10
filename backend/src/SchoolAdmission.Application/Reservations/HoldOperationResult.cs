namespace SchoolAdmission.Application.Reservations;

public sealed record HoldOperationResult<T>(
    T? Value,
    HoldManagementError? Error)
{
    public bool IsSuccess => Error is null;
}
