using SchoolAdmission.Domain.Entities;

namespace SchoolAdmission.Application.Reservations;

public sealed record HoldMutationResult(
    AdmissionHold? Hold,
    HoldMutationFailure? Failure)
{
    public bool IsSuccess => Failure is null;
}
