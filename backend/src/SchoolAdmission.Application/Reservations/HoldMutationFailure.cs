namespace SchoolAdmission.Application.Reservations;

public enum HoldMutationFailure
{
    HoldNotFound,
    OwnershipViolation,
    Expired,
    Cancelled,
    Confirmed
}
