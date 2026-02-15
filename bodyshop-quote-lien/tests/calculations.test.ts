import { describe, expect, it } from "vitest";
import { computeEstimateTotals } from "@/lib/calc/estimate";
import { computeBalance, computeAgingBucket } from "@/lib/calc/receivables";
import { computeStorageAccrual } from "@/lib/calc/storage";
import { evaluateLienRisk } from "@/lib/calc/lien";

describe("estimate totals", () => {
  it("computes labor, parts markup, sublet markup, tax and grand total", () => {
    const totals = computeEstimateTotals(
      [
        { category: "LABOR", quantity: 2, laborType: "BODY", laborHours: 2 },
        { category: "PARTS", quantity: 1, unitCostCents: 10000 },
        { category: "SUBLET", quantity: 1, unitCostCents: 20000 },
        { category: "FEE", quantity: 1, unitPriceCents: 3000 }
      ],
      {
        bodyLaborRateCents: 7500,
        paintLaborRateCents: 8000,
        mechLaborRateCents: 9000,
        detailLaborRateCents: 5000,
        partsMarkupRule: { tiers: [{ min: 0, max: null, markupPercent: 20 }] },
        subletMarkupPercent: 10,
        taxRatePercent: 8
      }
    );

    expect(totals.laborSubtotalCents).toBe(15000);
    expect(totals.partsSubtotalCents).toBe(12000);
    expect(totals.subletSubtotalCents).toBe(22000);
    expect(totals.grandTotalCents).toBeGreaterThan(0);
  });
});

describe("receivables", () => {
  it("computes balance and aging buckets", () => {
    expect(computeBalance(100000, 25000)).toBe(75000);

    const today = new Date("2026-02-15T00:00:00.000Z");
    expect(computeAgingBucket(new Date("2026-02-01T00:00:00.000Z"), today)).toBe("0-15");
    expect(computeAgingBucket(new Date("2026-01-20T00:00:00.000Z"), today)).toBe("16-30");
    expect(computeAgingBucket(new Date("2025-12-20T00:00:00.000Z"), today)).toBe("31-60");
    expect(computeAgingBucket(new Date("2025-10-01T00:00:00.000Z"), today)).toBe("60+");
  });
});

describe("storage accrual", () => {
  it("applies grace days", () => {
    const accrual = computeStorageAccrual({
      startDate: new Date("2026-02-01T00:00:00.000Z"),
      endDate: new Date("2026-02-11T00:00:00.000Z"),
      graceDays: 3,
      dailyRateCents: 5000
    });

    expect(accrual.totalDays).toBe(10);
    expect(accrual.billableDays).toBe(7);
    expect(accrual.totalAccruedCents).toBe(35000);
  });
});

describe("lien risk", () => {
  it("flags watch when overdue with balance", () => {
    const risk = evaluateLienRisk({
      balanceCents: 120000,
      completedDate: new Date("2026-01-01T00:00:00.000Z"),
      overdueThresholdDays: 15,
      storageThresholdDays: 10,
      pickupThresholdDays: 7,
      now: new Date("2026-02-15T00:00:00.000Z")
    });

    expect(risk.status).toBe("WATCH");
  });
});
