export type FinancialPeriod = {
  from: string;
  to: string;
  timezone: string;
};

export type FinancialAmountMetric = {
  amountMinor: number;
  invoiceCount?: number;
  paymentCount?: number;
  previousPeriodAmountMinor?: number;
  percentageChange: number | null;
};

export type FinancialBalanceMetric = {
  amountMinor: number;
  invoiceCount: number;
  debtorCount?: number;
};

export type CompanyFinancialSummaryResponse = {
  companyId: string;
  currencyCode: string;
  period: FinancialPeriod;
  sales: FinancialAmountMetric & { invoiceCount: number; previousPeriodAmountMinor: number };
  collected: FinancialAmountMetric & { paymentCount: number; previousPeriodAmountMinor: number };
  outstanding: FinancialBalanceMetric;
  overdue: FinancialBalanceMetric & { debtorCount: number };
  dueSoon: FinancialBalanceMetric;
  currencies: string[];
};

export type FinancialTrendPoint = {
  period: string;
  salesMinor: number;
  collectedMinor: number;
};

export type CompanyFinancialTrendsResponse = {
  companyId: string;
  currencyCode: string;
  period: FinancialPeriod;
  interval: "day" | "week" | "month";
  series: FinancialTrendPoint[];
};

export type TopDebtorRecord = {
  serviceClientId: string;
  serviceClientName: string;
  outstandingAmountMinor: number;
  overdueAmountMinor: number;
  invoiceCount: number;
  overdueInvoiceCount: number;
  oldestDueDate: string | null;
  currencyCode: string;
};

export type CompanyTopDebtorsResponse = {
  companyId: string;
  currencyCode: string;
  debtors: TopDebtorRecord[];
};

export type RecentPaymentRecord = {
  paymentId: string;
  invoiceId: string;
  invoiceNumber: string | null;
  clientName: string;
  amountMinor: number;
  currencyCode: string;
  method: string;
  receivedAt: string;
  status: string;
};

export type CompanyRecentPaymentsResponse = {
  companyId: string;
  currencyCode: string;
  payments: RecentPaymentRecord[];
};
