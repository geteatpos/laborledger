import { formatHourlyRate } from "./employee-utils";
import { formatEstimateAmount } from "./weekly-close-utils";

export type LaborPayBillingPreview = {
  company: { id: string; name: string };
  periodStart: string;
  periodEnd: string;
  weekStatus: "OPEN" | "CLOSED" | "REOPENED";
  dataSource: "closed_snapshot" | "live_approved" | "none";
  dataSourceLabel: string;
  snapshotVersion: number | null;
  currencyCode: string;
  employeePayPrep: EmployeePayPrepRow[];
  clientLaborBilling: ClientLaborBillingRow[];
  excludedShifts: ExcludedShiftWarning[];
  totals: {
    approvedShiftCount: number;
    payableMinutes: number;
    employeeGrossEstimateMinor: number;
    clientLaborEstimateMinor: number;
    grossMarginEstimateMinor: number;
  };
  filters: {
    weekStart: string;
    weekEnd: string;
    serviceClientId?: string | undefined;
    locationId?: string | undefined;
    employeeId?: string | undefined;
    onlyClosedWeeks: boolean;
  };
  draftSupported: true;
};

export type LaborBillingDraftSnapshot = {
  generatedAt: string;
  generatedByUserId: string;
  generatedByName: string | null;
  periodStart: string;
  periodEnd: string;
  weekStatus: LaborPayBillingPreview["weekStatus"];
  dataSource: LaborPayBillingPreview["dataSource"];
  dataSourceLabel: string;
  snapshotVersion: number | null;
  currencyCode: string;
  filters: LaborPayBillingPreview["filters"];
  shiftRows: Array<{
    shiftId: string;
    employeeId: string;
    employeeName: string;
    locationId: string;
    locationName: string;
    serviceClientId: string;
    serviceClientName: string;
    payableMinutes: number;
    employeeRateMinor: number;
    clientRateMinor: number;
    employeeAmountMinor: number;
    clientAmountMinor: number;
    grossMarginMinor: number;
  }>;
  employeePayPrep: EmployeePayPrepRow[];
  clientLaborBilling: ClientLaborBillingRow[];
  excludedShifts: ExcludedShiftWarning[];
  totals: LaborPayBillingPreview["totals"];
};

export type LaborBillingDraftSummary = {
  id: string;
  companyId: string;
  locationId: string | null;
  periodStart: string;
  periodEnd: string;
  status: "DRAFT" | "LOCKED" | "VOIDED";
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    fullName: string | null;
  };
  totals: LaborPayBillingPreview["totals"];
  filters: LaborPayBillingPreview["filters"];
};

export type LaborBillingDraftDetail = LaborBillingDraftSummary & {
  snapshot: LaborBillingDraftSnapshot;
};

export type EmployeePayPrepRow = {
  employeeId: string;
  employeeName: string;
  locationId: string;
  locationName: string;
  serviceClientId: string;
  serviceClientName: string;
  periodStart: string;
  periodEnd: string;
  approvedPayableMinutes: number;
  approvedPayableHoursDecimal: number;
  employeeRateMinor: number;
  estimatedGrossPayMinor: number;
  shiftCount: number;
  warnings: string[];
};

export type ClientLaborBillingRow = {
  serviceClientId: string;
  serviceClientName: string;
  locationId: string;
  locationName: string;
  employeeId: string;
  employeeName: string;
  periodStart: string;
  periodEnd: string;
  approvedBillableMinutes: number;
  approvedBillableHoursDecimal: number;
  clientLaborRateMinor: number;
  estimatedClientChargeMinor: number;
  estimatedGrossPayMinor: number;
  estimatedMarginMinor: number;
  shiftCount: number;
  warnings: string[];
};

export type ExcludedShiftWarning = {
  shiftId: string;
  employeeName: string;
  locationName: string;
  reasonCode: string;
  message: string;
};

export const EMPLOYEE_PAY_DISCLAIMER =
  "For employee pay prep only. Amounts are gross-pay estimates — not tax payroll, bank payroll, or accounting.";

export const CLIENT_BILLING_DISCLAIMER =
  "For client labor billing prep only. Amounts are labor charge estimates — not issued invoices unless drafted and issued separately.";

export function buildLaborPayBillingQuery(input: {
  weekStart: string;
  serviceClientId?: string | undefined;
  locationId?: string | undefined;
  employeeId?: string | undefined;
  onlyClosedWeeks?: boolean | undefined;
}) {
  const params = new URLSearchParams();
  params.set("weekStart", input.weekStart);

  if (input.serviceClientId) {
    params.set("serviceClientId", input.serviceClientId);
  }

  if (input.locationId) {
    params.set("locationId", input.locationId);
  }

  if (input.employeeId) {
    params.set("employeeId", input.employeeId);
  }

  if (input.onlyClosedWeeks) {
    params.set("onlyClosedWeeks", "true");
  }

  return `?${params.toString()}`;
}

export function formatPayableHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export function formatLaborRate(rateMinor: number, currencyCode: string) {
  return `${formatHourlyRate(rateMinor, currencyCode)}/hr`;
}

export function formatLaborMoney(minor: number, currencyCode: string) {
  return formatEstimateAmount(minor, currencyCode);
}

export function buildLaborCsvHref(
  kind: "payroll" | "client-billing",
  companyId: string,
  filters: LaborPayBillingPreview["filters"]
) {
  const suffix = buildLaborPayBillingQuery({
    weekStart: filters.weekStart,
    ...(filters.serviceClientId ? { serviceClientId: filters.serviceClientId } : {}),
    ...(filters.locationId ? { locationId: filters.locationId } : {}),
    ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    ...(filters.onlyClosedWeeks ? { onlyClosedWeeks: true } : {})
  });

  return `/api/company-operations/companies/${companyId}/labor-pay-billing/${kind === "payroll" ? "payroll-csv" : "client-billing-csv"}${suffix}`;
}

export function buildLaborDraftCsvHref(
  kind: "payroll" | "client-billing",
  companyId: string,
  draftId: string
) {
  return `/api/company-operations/companies/${companyId}/labor-pay-billing/drafts/${draftId}/${kind === "payroll" ? "payroll.csv" : "client-billing.csv"}`;
}

export function weekStatusBadgeClass(status: LaborPayBillingPreview["weekStatus"]) {
  switch (status) {
    case "CLOSED":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "REOPENED":
      return "border-amber-200 bg-amber-50 text-amber-900";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}
