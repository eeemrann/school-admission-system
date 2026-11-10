namespace SchoolAdmission.Application.Reservations;

public sealed record HoldConfirmationResponse(
    string HoldId,
    string Status);
