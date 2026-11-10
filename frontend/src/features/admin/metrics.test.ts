import type { ClassSummary } from "../../types/api";
import { deriveAdminMetrics, getClassUtilizationPercent, getUtilizationPercent } from "./metrics";

function classSummary(overrides: Partial<ClassSummary> = {}): ClassSummary {
  return {
    id: "c_test",
    name: "Test class",
    totalSeats: 100,
    heldSeats: 10,
    confirmedSeats: 20,
    availableSeats: 70,
    ...overrides,
  };
}

describe("admin metrics", () => {
  it("derives seat totals while preserving the backend seat-count invariant", () => {
    const metrics = deriveAdminMetrics([
      classSummary(),
      classSummary({
        id: "c_test_2",
        totalSeats: 50,
        heldSeats: 5,
        confirmedSeats: 15,
        availableSeats: 30,
      }),
    ]);

    expect(metrics).toMatchObject({
      totalClasses: 2,
      totalCapacity: 150,
      totalHeldSeats: 15,
      totalConfirmedSeats: 35,
      totalAvailableSeats: 100,
      occupiedSeats: 50,
      utilizationPercent: 33,
    });
    expect(metrics.totalCapacity).toBe(
      metrics.totalHeldSeats + metrics.totalConfirmedSeats + metrics.totalAvailableSeats,
    );
  });

  it("protects empty and zero-capacity calculations", () => {
    expect(deriveAdminMetrics([])).toMatchObject({
      totalClasses: 0,
      totalCapacity: 0,
      totalAvailableSeats: 0,
      utilizationPercent: 0,
    });
    expect(getUtilizationPercent(10, 0)).toBe(0);
    expect(getClassUtilizationPercent(classSummary({ totalSeats: 0 }))).toBe(0);
  });

  it("rounds utilization and handles large seat counts without truncating values", () => {
    expect(getUtilizationPercent(2, 3)).toBe(67);
    const large = classSummary({
      totalSeats: Number.MAX_SAFE_INTEGER - 2,
      heldSeats: 1_000_000_000_000,
      confirmedSeats: 2_000_000_000_000,
      availableSeats: Number.MAX_SAFE_INTEGER - 3_000_000_000_002,
    });

    const metrics = deriveAdminMetrics([large]);
    expect(metrics.totalCapacity).toBe(Number.MAX_SAFE_INTEGER - 2);
    expect(metrics.totalAvailableSeats).toBe(Number.MAX_SAFE_INTEGER - 3_000_000_000_002);
    expect(metrics.totalCapacity).toBe(
      metrics.totalHeldSeats + metrics.totalConfirmedSeats + metrics.totalAvailableSeats,
    );
  });
});
