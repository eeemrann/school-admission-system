using SchoolAdmission.Domain.Entities;

namespace SchoolAdmission.Application.Abstractions.Persistence;

public interface IAdmissionClassRepository
{
    Task AddAsync(AdmissionClass admissionClass, CancellationToken cancellationToken);

    Task<IReadOnlyList<AdmissionClass>> ListAsync(CancellationToken cancellationToken);

    Task<AdmissionClass?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    Task<AdmissionClass?> UpdateAsync(
        Guid id,
        string? name,
        int? totalSeats,
        CancellationToken cancellationToken);
}
