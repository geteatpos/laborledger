import { describe, expect, it } from "vitest";

import {
  buildFinancialQuery,
  collectedEmptyMessage,
  formatPercentageChange,
  overdueEmptyMessage,
  outstandingEmptyMessage,
  salesEmptyMessage
} from "../../apps/admin/src/lib/financial-dashboard-utils";

describe("financial-dashboard-utils", () => {
  it("builds query strings with company-scoped period presets", () => {
    expect(buildFinancialQuery({ preset: "30d", timezone: "America/New_York" })).toContain(
      "preset=30d"
    );
    expect(buildFinancialQuery({ preset: "custom", from: "2026-07-01", to: "2026-07-31" })).toContain(
      "from=2026-07-01"
    );
  });

  it("formats percentage change and zero-state copy", () => {
    expect(formatPercentageChange(12.5)).toBe("+12.5%");
    expect(formatPercentageChange(-4)).toBe("-4.0%");
    expect(formatPercentageChange(null)).toBeNull();
    expect(salesEmptyMessage(0)).toBe("No sales in this period");
    expect(collectedEmptyMessage(0)).toBe("No payments received in this period");
    expect(outstandingEmptyMessage(0)).toBe("No outstanding invoices");
    expect(overdueEmptyMessage(0)).toBe("No overdue invoices");
    expect(salesEmptyMessage(100)).toBeNull();
  });
});
