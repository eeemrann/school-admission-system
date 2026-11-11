using SchoolAdmission.Application.Abstractions.Persistence;
using SchoolAdmission.Domain.Entities;

namespace SchoolAdmission.Application.Classes;

public sealed class ClassManagementService(
    IAdmissionClassRepository repository,
    TimeProvider timeProvider) : IClassManagementService
{
    public async Task<ClassOperationResult<CreatedClassResponse>> CreateAsync(
        CreateClassRequest? request,
        CancellationToken cancellationToken)
    {
        if (request is null)
        {
            return new ClassOperationResult<CreatedClassResponse>(
                null,
                ValidationError("A request body is required."));
        }

        var name = request.Name?.Trim();
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        if (string.IsNullOrWhiteSpace(name))
        {
            errors["name"] = ["Class name cannot be empty or whitespace."];
        }

        if (request.TotalSeats <= 0)
        {
            errors["totalSeats"] = ["Total seats must be greater than zero."];
        }

        if (errors.Count > 0)
        {
            return new ClassOperationResult<CreatedClassResponse>(
                null,
                ValidationError("One or more class fields are invalid.", errors));
        }

        var admissionClass = new AdmissionClass
        {
            Id = Guid.NewGuid(),
            Name = name!,
            TotalSeats = request.TotalSeats,
            HeldSeats = 0,
            ConfirmedSeats = 0,
            CreatedAt = timeProvider.GetUtcNow()
        };

        await repository.AddAsync(admissionClass, cancellationToken);

        return new ClassOperationResult<CreatedClassResponse>(
            new CreatedClassResponse(
                ClassIdCodec.ToPublicId(admissionClass.Id),
                admissionClass.Name,
                admissionClass.TotalSeats),
            null);
    }

    public async Task<IReadOnlyList<ClassSummaryResponse>> ListAsync(CancellationToken cancellationToken)
    {
        var classes = await repository.ListAsync(cancellationToken);

        return classes
            .Select(MapSummary)
            .ToArray();
    }

    public async Task<ClassOperationResult<ClassSummaryResponse>> GetByIdAsync(
        string? publicClassId,
        CancellationToken cancellationToken)
    {
        if (!ClassIdCodec.TryParse(publicClassId, out var id))
        {
            return new ClassOperationResult<ClassSummaryResponse>(
                null,
                ValidationError("Class ID must use the c_ prefix followed by a valid UUID."));
        }

        var admissionClass = await repository.GetByIdAsync(id, cancellationToken);

        return admissionClass is null
            ? new ClassOperationResult<ClassSummaryResponse>(
                null,
                new ClassManagementError(
                    ClassManagementErrorCode.ClassNotFound,
                    "The requested class was not found."))
            : new ClassOperationResult<ClassSummaryResponse>(MapSummary(admissionClass), null);
    }

    public async Task<ClassOperationResult<ClassSummaryResponse>> UpdateAsync(
        string? publicClassId,
        UpdateClassRequest? request,
        CancellationToken cancellationToken)
    {
        if (!ClassIdCodec.TryParse(publicClassId, out var id))
        {
            return new ClassOperationResult<ClassSummaryResponse>(
                null,
                ValidationError("Class ID must use the c_ prefix followed by a valid UUID."));
        }

        if (request is null)
        {
            return new ClassOperationResult<ClassSummaryResponse>(
                null,
                ValidationError("A request body is required."));
        }

        var name = request.Name?.Trim();
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        if (request.Name is not null && string.IsNullOrWhiteSpace(name))
        {
            errors["name"] = ["Class name cannot be empty or whitespace."];
        }

        if (request.TotalSeats.HasValue && request.TotalSeats.Value <= 0)
        {
            errors["totalSeats"] = ["Total seats must be greater than zero."];
        }

        if (request.Name is null && !request.TotalSeats.HasValue)
        {
            errors["request"] = ["Provide a class name or total seat capacity to update."];
        }

        if (errors.Count > 0)
        {
            return new ClassOperationResult<ClassSummaryResponse>(
                null,
                ValidationError("One or more class fields are invalid.", errors));
        }

        var current = await repository.GetByIdAsync(id, cancellationToken);
        if (current is null)
        {
            return new ClassOperationResult<ClassSummaryResponse>(
                null,
                new ClassManagementError(
                    ClassManagementErrorCode.ClassNotFound,
                    "The requested class was not found."));
        }

        if (request.TotalSeats.HasValue && request.TotalSeats.Value < current.TotalSeats)
        {
            return new ClassOperationResult<ClassSummaryResponse>(
                null,
                new ClassManagementError(
                    ClassManagementErrorCode.CapacityCannotDecrease,
                    "Class capacity cannot be decreased because it could invalidate existing seat reservations."));
        }

        var admissionClass = await repository.UpdateAsync(id, name, request.TotalSeats, cancellationToken);

        return admissionClass is null
            ? new ClassOperationResult<ClassSummaryResponse>(
                null,
                new ClassManagementError(
                    ClassManagementErrorCode.ClassNotFound,
                    "The requested class was not found."))
            : new ClassOperationResult<ClassSummaryResponse>(MapSummary(admissionClass), null);
    }

    private static ClassSummaryResponse MapSummary(AdmissionClass admissionClass)
    {
        var availableSeats = admissionClass.TotalSeats
            - admissionClass.HeldSeats
            - admissionClass.ConfirmedSeats;

        return new ClassSummaryResponse(
            ClassIdCodec.ToPublicId(admissionClass.Id),
            admissionClass.Name,
            admissionClass.TotalSeats,
            admissionClass.HeldSeats,
            admissionClass.ConfirmedSeats,
            availableSeats);
    }

    private static ClassManagementError ValidationError(
        string detail,
        IReadOnlyDictionary<string, string[]>? errors = null) =>
        new(ClassManagementErrorCode.ValidationError, detail, errors);
}
