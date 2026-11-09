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
}
