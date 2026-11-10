namespace SchoolAdmission.Application.Reservations;

public enum HoldReservationFailure
{
    ClassNotFound,
    DuplicateActiveApplication,
    NoSeatsAvailable
}

public sealed record HoldReservationResult(
    SchoolAdmission.Domain.Entities.AdmissionHold? Hold,
    HoldReservationFailure? Failure)
{
    public bool IsSuccess => Failure is null;
}
