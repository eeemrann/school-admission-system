namespace SchoolAdmission.Application.Classes;

public sealed record CreatedClassResponse(
    string Id,
    string Name,
    int TotalSeats);
