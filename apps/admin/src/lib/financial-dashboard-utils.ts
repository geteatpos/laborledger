import { formatClientInvoiceMoney } from "./client-invoice-utils";

export type FinancialPeriodPreset = "7d" | "30d" | "90d" | "year" | "custom";

export type FinancialSummaryResponse = {
  companyId: string;
  currencyCode: string;
  period: { from: string; to: string; timezone: string };
  sales: {
    amountMinor: number;
    invoiceCount: number;
    previousPeriodAmountMinor: number;
    percentageChange: number | null;
  };
  collected: {
    amountMinor: number;
    paymentCount: number;
    previousPeriodAmountMinor: number;
    percentageChange: number | null;
  };
  outstanding: {
    amountMinor: number;
    invoiceCount: number;
  };
  overdue: {
    amountMinor: number;
    invoiceCount: number;
    debtorCount: number;
  };
  dueSoon: {
    amountMinor: number;
    invoiceCount: number;
  };
  currencies: string[];
};

export type FinancialTrendsResponse = {
  companyId: string;
  currencyCode: string;
  period: { from: string; to: string; timezone: string };
  interval: "day" | "week" | "month";
  series: Array<{ period: string; salesMinor: number; collectedMinor: number }>;
};

export type TopDebtorsResponse = {
  companyId: string;
  currencyCode: string;
  debtors: Array<{
    serviceClientId: string;
    serviceClientName: string;
    outstandingAmountMinor: number;
    overdueAmountMinor: number;
    invoiceCount: number;
    overdueInvoiceCount: number;
    oldestDueDate: string | null;
    currencyCode: string;
  }>;
};

export type RecentPaymentsResponse = {
  companyId: string;
  currencyCode: string;
  payments: Array<{
    paymentId: string;
    invoiceId: string;
    invoiceNumber: string | null;
    clientName: string;
    amountMinor: number;
    currencyCode: string;
    method: string;
    receivedAt: string;
    status: string;
  }>;
};

export const FINANCIAL_PERIOD_PRESETS: Array<{
  value: FinancialPeriodPreset;
  label: string;
}> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom" }
];

export const FINANCIAL_KPI_DEFINITIONS = {
  sales: "Sum of ISSUED invoices in the selected period. Draft and void invoices are excluded.",
  collected: "Sum of confirmed (POSTED) payments received in the selected period.",
  outstanding: "Remaining balance on issued invoices that are not voided.",
  overdue: "Outstanding balance on issued invoices whose due date is before today."
} as const;

export function buildFinancialQuery(options: {
  preset: FinancialPeriodPreset;
  from?: string;
  to?: string;
  timezone?: string;
  interval?: string;
}) {
  const params = new URLSearchParams();
  params.set("preset", options.preset);
  if (options.preset === "custom") {
    if (options.from) params.set("from", options.from);
    if (options.to) params.set("to", options.to);
  }
  if (options.timezone) params.set("timezone", options.timezone);
  if (options.interval) params.set("interval", options.interval);
  return `?${params.toString()}`;
}

export function financialSummaryPath(companyId: string, query: string) {
  return `/api/company-operations/companies/${encodeURIComponent(companyId)}/financial-summary${query}`;
}

export function financialTrendsPath(companyId: string, query: string) {
  return `/api/company-operations/companies/${encodeURIComponent(companyId)}/financial-trends${query}`;
}

export function topDebtorsPath(companyId: string) {
  return `/api/company-operations/companies/${encodeURIComponent(companyId)}/top-debtors?limit=5`;
}

export function recentPaymentsPath(companyId: string) {
  return `/api/company-operations/companies/${encodeURIComponent(companyId)}/recent-payments?limit=8`;
}

export function formatFinancialMoney(amountMinor: number, currencyCode = "USD") {
  try {
    return formatClientInvoiceMoney(amountMinor, currencyCode);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currencyCode || "???"}`;
  }
}

export function formatPercentageChange(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

export function formatPaymentMethodLabel(method: string) {
  if (method === "CASH") return "Cash";
  if (method === "BANK_TRANSFER") return "Transfer";
  if (method === "CARD") return "Card";
  return method;
}

export function salesEmptyMessage(amountMinor: number) {
  return amountMinor === 0 ? "No sales in this period" : null;
}

export function collectedEmptyMessage(amountMinor: number) {
  return amountMinor === 0 ? "No payments received in this period" : null;
}

export function outstandingEmptyMessage(amountMinor: number) {
  return amountMinor === 0 ? "No outstanding invoices" : null;
}

export function overdueEmptyMessage(invoiceCount: number) {
  return invoiceCount === 0 ? "No overdue invoices" : null;
}
