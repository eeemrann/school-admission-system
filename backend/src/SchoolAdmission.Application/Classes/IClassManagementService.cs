namespace SchoolAdmission.Application.Classes;

public interface IClassManagementService
{
    Task<ClassOperationResult<CreatedClassResponse>> CreateAsync(
        CreateClassRequest? request,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<ClassSummaryResponse>> ListAsync(CancellationToken cancellationToken);

    Task<ClassOperationResult<ClassSummaryResponse>> GetByIdAsync(
        string? publicClassId,
        CancellationToken cancellationToken);

    Task<ClassOperationResult<ClassSummaryResponse>> UpdateAsync(
        string? publicClassId,
        UpdateClassRequest? request,
        CancellationToken cancellationToken);
}
