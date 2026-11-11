using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Application.Abstractions.Persistence;
using SchoolAdmission.Domain.Entities;

namespace SchoolAdmission.Infrastructure.Persistence.Repositories;

public sealed class EfAdmissionClassRepository(SchoolAdmissionDbContext dbContext) : IAdmissionClassRepository
{
    public async Task AddAsync(AdmissionClass admissionClass, CancellationToken cancellationToken)
    {
        dbContext.AdmissionClasses.Add(admissionClass);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AdmissionClass>> ListAsync(CancellationToken cancellationToken)
    {
        return await dbContext.AdmissionClasses
            .AsNoTracking()
            .OrderBy(admissionClass => admissionClass.Name)
            .ThenBy(admissionClass => admissionClass.Id)
            .ToListAsync(cancellationToken);
    }

    public Task<AdmissionClass?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        return dbContext.AdmissionClasses
            .AsNoTracking()
            .SingleOrDefaultAsync(admissionClass => admissionClass.Id == id, cancellationToken);
    }

    public async Task<AdmissionClass?> UpdateAsync(
        Guid id,
        string? name,
        int? totalSeats,
        CancellationToken cancellationToken)
    {
        var admissionClass = await dbContext.AdmissionClasses
            .SingleOrDefaultAsync(admissionClass => admissionClass.Id == id, cancellationToken);

        if (admissionClass is null)
        {
            return null;
        }

        if (name is not null)
        {
            admissionClass.Name = name;
        }

        if (totalSeats.HasValue)
        {
            admissionClass.TotalSeats = totalSeats.Value;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return admissionClass;
    }
}
