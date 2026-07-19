import { describe, expect, it } from "vitest";

import { buildDashboardAnalytics, toChartMajorUnits } from "@/features/analytics/dashboard-analytics";

describe("dashboard analytics", () => {
  it("aggregates authoritative minor units by currency, month, and group", () => {
    const result = buildDashboardAnalytics([
      { groupId: "a", groupName: "Trip", currency: "MYR", expenseDate: new Date("2026-06-01T00:00:00Z"), amountMinor: 10_000n, personalShareMinor: 4_000n },
      { groupId: "a", groupName: "Trip", currency: "MYR", expenseDate: new Date("2026-06-20T00:00:00Z"), amountMinor: 2_500n, personalShareMinor: 1_000n },
      { groupId: "b", groupName: "Work", currency: "USD", expenseDate: new Date("2026-07-01T00:00:00Z"), amountMinor: 5_000n, personalShareMinor: 2_500n },
    ]);
    expect(result.currencies).toEqual([
      { currency: "MYR", totalSpendMinor: 12_500n, personalShareMinor: 5_000n, expenseCount: 2 },
      { currency: "USD", totalSpendMinor: 5_000n, personalShareMinor: 2_500n, expenseCount: 1 },
    ]);
    expect(result.months[0]).toMatchObject({ month: "2026-06", currency: "MYR", totalSpendMinor: 12_500n });
    expect(result.groups.map((group) => group.groupId)).toEqual(["a", "b"]);
  });

  it("returns stable empty analytics", () => {
    expect(buildDashboardAnalytics([])).toEqual({ currencies: [], months: [], groups: [] });
  });

  it("bounds display-only chart conversion without changing stored totals", () => {
    expect(toChartMajorUnits(12_345n)).toBe(123.45);
    expect(toChartMajorUnits(9_223_372_036_854_775_807n)).toBe(Number.MAX_SAFE_INTEGER / 100);
  });
});
