namespace SchoolAdmission.Application.Classes;

public sealed record UpdateClassRequest(string? Name, int? TotalSeats = null);
