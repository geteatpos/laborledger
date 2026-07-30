import { describe, expect, it } from "vitest";

import {
  accumulateDebtor,
  invoiceBalanceMinor,
  isInvoiceDueSoon,
  isInvoiceOverdue,
  percentageChange,
  pickPrimaryCurrencyTotal,
  rankTopDebtors,
  sumByCurrency
} from "../src/modules/financial-reports/financial-reports.calculations";
import {
  buildPeriodKeys,
  MAX_FINANCIAL_REPORT_RANGE_DAYS,
  previousPeriodRange,
  resolveFinancialReportDateRange,
  resolveTrendInterval
} from "../src/modules/financial-reports/financial-reports-date-range";

describe("financial-reports.calculations", () => {
  const now = new Date("2026-07-29T12:00:00.000Z");

  it("computes percentage change and treats zero previous as null", () => {
    expect(percentageChange(12000, 10000)).toBe(20);
    expect(percentageChange(8000, 10000)).toBe(-20);
    expect(percentageChange(5000, 0)).toBeNull();
  });

  it("uses balanceMinor and detects overdue / due soon", () => {
    expect(invoiceBalanceMinor({ balanceMinor: 2500, totalMinor: 9000 })).toBe(2500);
    expect(invoiceBalanceMinor({ balanceMinor: 0, totalMinor: 9000 })).toBe(0);

    expect(
      isInvoiceOverdue(
        { dueDate: new Date("2026-07-20T00:00:00.000Z"), balanceMinor: 1000, totalMinor: 1000 },
        now
      )
    ).toBe(true);

    expect(
      isInvoiceOverdue(
        { dueDate: new Date("2026-07-20T00:00:00.000Z"), balanceMinor: 0, totalMinor: 1000 },
        now
      )
    ).toBe(false);

    expect(
      isInvoiceDueSoon(
        { dueDate: new Date("2026-08-02T00:00:00.000Z"), balanceMinor: 500, totalMinor: 500 },
        now
      )
    ).toBe(true);

    expect(
      isInvoiceDueSoon(
        { dueDate: new Date("2026-08-20T00:00:00.000Z"), balanceMinor: 500, totalMinor: 500 },
        now
      )
    ).toBe(false);
  });

  it("ranks top debtors by overdue then outstanding", () => {
    const map = new Map();
    accumulateDebtor(
      map,
      {
        serviceClientId: "a",
        serviceClientName: "A",
        balanceMinor: 5000,
        totalMinor: 5000,
        dueDate: new Date("2026-08-10T00:00:00.000Z"),
        currencyCode: "USD"
      },
      now
    );
    accumulateDebtor(
      map,
      {
        serviceClientId: "b",
        serviceClientName: "B",
        balanceMinor: 2000,
        totalMinor: 2000,
        dueDate: new Date("2026-07-01T00:00:00.000Z"),
        currencyCode: "USD"
      },
      now
    );
    accumulateDebtor(
      map,
      {
        serviceClientId: "c",
        serviceClientName: "C",
        balanceMinor: 9000,
        totalMinor: 9000,
        dueDate: new Date("2026-08-15T00:00:00.000Z"),
        currencyCode: "USD"
      },
      now
    );

    const ranked = rankTopDebtors([...map.values()], 2);
    expect(ranked[0]?.serviceClientId).toBe("b");
    expect(ranked[1]?.serviceClientId).toBe("c");
  });

  it("does not combine currencies into a false total", () => {
    const totals = sumByCurrency([
      { currencyCode: "USD", amountMinor: 1000 },
      { currencyCode: "EUR", amountMinor: 2000 },
      { currencyCode: "USD", amountMinor: 500 }
    ]);
    const primary = pickPrimaryCurrencyTotal(totals, "USD");
    expect(primary.amountMinor).toBe(1500);
    expect(primary.currencies).toEqual(["EUR", "USD"]);
  });
});

describe("financial-reports-date-range", () => {
  it("resolves presets relative to company timezone", () => {
    const range = resolveFinancialReportDateRange({
      preset: "7d",
      timezone: "America/New_York",
      now: new Date("2026-07-29T18:00:00.000Z")
    });

    expect(range.to).toBe("2026-07-29");
    expect(range.from).toBe("2026-07-23");
    expect(range.timezone).toBe("America/New_York");
    expect(range.fromUtc.toISOString()).toBe("2026-07-23T04:00:00.000Z");
  });

  it("builds previous period of equal length", () => {
    const range = resolveFinancialReportDateRange({
      from: "2026-07-01",
      to: "2026-07-10",
      timezone: "UTC",
      preset: "custom"
    });
    const previous = previousPeriodRange(range);
    expect(previous.from).toBe("2026-06-21");
    expect(previous.to).toBe("2026-06-30");
  });

  it("fills trend period keys without gaps", () => {
    const range = resolveFinancialReportDateRange({
      from: "2026-07-01",
      to: "2026-07-03",
      timezone: "UTC",
      preset: "custom"
    });
    expect(buildPeriodKeys(range, "day")).toEqual(["2026-07-01", "2026-07-02", "2026-07-03"]);
    expect(resolveTrendInterval(range)).toBe("day");
  });

  it("rejects invalid ranges", () => {
    expect(() =>
      resolveFinancialReportDateRange({ from: "2026-07-10", to: "2026-07-01", timezone: "UTC" })
    ).toThrow(/from must be on or before to/i);

    expect(() =>
      resolveFinancialReportDateRange({ from: "2024-01-01", to: "2026-07-01", timezone: "UTC" })
    ).toThrow(new RegExp(`${MAX_FINANCIAL_REPORT_RANGE_DAYS} days`, "i"));
  });
});
