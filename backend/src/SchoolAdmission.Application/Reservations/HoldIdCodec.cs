namespace SchoolAdmission.Application.Reservations;

public static class HoldIdCodec
{
    private const string Prefix = "h_";

    public static string ToPublicId(Guid id) => $"{Prefix}{id:N}";

    public static bool TryParse(string? publicId, out Guid id)
    {
        id = Guid.Empty;

        return publicId is not null
            && publicId.StartsWith(Prefix, StringComparison.Ordinal)
            && publicId.Length == Prefix.Length + 32
            && Guid.TryParseExact(publicId[Prefix.Length..], "N", out id);
    }
}
