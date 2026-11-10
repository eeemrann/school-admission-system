import type { ClassSummary } from "../../types/api";

export interface AdminClassMetrics {
  totalClasses: number;
  totalCapacity: number;
  totalHeldSeats: number;
  totalConfirmedSeats: number;
  totalAvailableSeats: number;
  occupiedSeats: number;
  utilizationPercent: number;
}

export function getClassUtilizationPercent(admissionClass: ClassSummary): number {
  return getUtilizationPercent(
    admissionClass.heldSeats + admissionClass.confirmedSeats,
    admissionClass.totalSeats,
  );
}

export function getUtilizationPercent(occupiedSeats: number, totalSeats: number): number {
  if (totalSeats <= 0) {
    return 0;
  }

  return Math.round((occupiedSeats / totalSeats) * 100);
}

export function deriveAdminMetrics(classes: readonly ClassSummary[]): AdminClassMetrics {
  const metrics = classes.reduce(
    (totals, admissionClass) => {
      totals.totalCapacity += admissionClass.totalSeats;
      totals.totalHeldSeats += admissionClass.heldSeats;
      totals.totalConfirmedSeats += admissionClass.confirmedSeats;
      totals.totalAvailableSeats += admissionClass.availableSeats;
      return totals;
    },
    {
      totalCapacity: 0,
      totalHeldSeats: 0,
      totalConfirmedSeats: 0,
      totalAvailableSeats: 0,
    },
  );

  const occupiedSeats = metrics.totalHeldSeats + metrics.totalConfirmedSeats;

  return {
    totalClasses: classes.length,
    ...metrics,
    occupiedSeats,
    utilizationPercent: getUtilizationPercent(occupiedSeats, metrics.totalCapacity),
  };
}
