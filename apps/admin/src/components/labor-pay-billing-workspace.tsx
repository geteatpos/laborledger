"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PayrollSourceCallout } from "./payroll-source-callout";
import type { CompanyRecord } from "../lib/employee-utils";
import { LABOR_BILLING_DRAFT_SNAPSHOT_COPY } from "../lib/billing-module-copy";
import {
  addDaysToDateKey,
  formatDateKeyLabel,
  type EmployeeOption,
  type LocationOption,
  type ServiceClientOption
} from "../lib/shift-utils";
import {
  buildLaborCsvHref,
  buildLaborDraftCsvHref,
  CLIENT_BILLING_DISCLAIMER,
  EMPLOYEE_PAY_DISCLAIMER,
  formatLaborMoney,
  formatLaborRate,
  formatPayableHours,
  weekStatusBadgeClass,
  type LaborBillingDraftDetail,
  type LaborBillingDraftSummary,
  type LaborPayBillingPreview
} from "../lib/labor-pay-billing-utils";
import {
  buildLaborWorkContextHref,
  LABOR_WORK_LOG_DISCLAIMER,
  type LaborWorkWeekSummary
} from "../lib/labor-work-log-utils";

type LaborPayBillingWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly preview: LaborPayBillingPreview;
  readonly drafts: LaborBillingDraftSummary[];
  readonly selectedDraft: LaborBillingDraftDetail | null;
  readonly workContextSummary: LaborWorkWeekSummary;
  readonly locations: LocationOption[];
  readonly serviceClients: ServiceClientOption[];
  readonly employees: EmployeeOption[];
  readonly canManageCompany: boolean;
  readonly initialWeekStart: string;
  readonly initialServiceClientId: string;
  readonly initialLocationId: string;
  readonly initialEmployeeId: string;
  readonly initialOnlyClosedWeeks: boolean;
  readonly initialDraftId: string;
  readonly thisWeekStart: string;
};

export function LaborPayBillingWorkspace({
  companies,
  selectedCompany,
  preview,
  drafts,
  selectedDraft,
  workContextSummary,
  locations,
  serviceClients,
  employees,
  canManageCompany,
  initialWeekStart,
  initialServiceClientId,
  initialLocationId,
  initialEmployeeId,
  initialOnlyClosedWeeks,
  initialDraftId,
  thisWeekStart
}: LaborPayBillingWorkspaceProps) {
  const router = useRouter();
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftActionError, setDraftActionError] = useState<string | null>(null);

  const previousWeekStart = addDaysToDateKey(initialWeekStart, -7);
  const nextWeekStart = addDaysToDateKey(initialWeekStart, 7);

  function buildHref(overrides: {
    companyId?: string;
    weekStart?: string;
    serviceClientId?: string;
    locationId?: string;
    employeeId?: string;
    onlyClosedWeeks?: boolean;
    draftId?: string | null;
  }) {
    const params = new URLSearchParams();
    params.set("companyId", overrides.companyId ?? selectedCompany.id);
    params.set("weekStart", overrides.weekStart ?? initialWeekStart);

    const serviceClientId = overrides.serviceClientId ?? initialServiceClientId;
    if (serviceClientId) {
      params.set("serviceClientId", serviceClientId);
    }

    const locationId = overrides.locationId ?? initialLocationId;
    if (locationId) {
      params.set("locationId", locationId);
    }

    const employeeId = overrides.employeeId ?? initialEmployeeId;
    if (employeeId) {
      params.set("employeeId", employeeId);
    }

    const onlyClosedWeeks = overrides.onlyClosedWeeks ?? initialOnlyClosedWeeks;
    if (onlyClosedWeeks) {
      params.set("onlyClosedWeeks", "true");
    }

    const draftId =
      overrides.draftId === null
        ? ""
        : overrides.draftId !== undefined
          ? overrides.draftId
          : initialDraftId;
    if (draftId) {
      params.set("draftId", draftId);
    }

    return `/labor-billing?${params.toString()}`;
  }

  async function handleSaveDraft() {
    setDraftActionError(null);
    setIsSavingDraft(true);

    try {
      const response = await fetch(
        `/api/company-operations/companies/${selectedCompany.id}/labor-pay-billing/drafts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weekStart: initialWeekStart,
            ...(initialServiceClientId ? { serviceClientId: initialServiceClientId } : {}),
            ...(initialLocationId ? { locationId: initialLocationId } : {}),
            ...(initialEmployeeId ? { employeeId: initialEmployeeId } : {}),
            ...(initialOnlyClosedWeeks ? { onlyClosedWeeks: "true" } : {})
          })
        }
      );

      const payload = (await response.json().catch(() => ({}))) as {
        message?: string | string[];
        id?: string;
      };

      if (!response.ok) {
        setDraftActionError(
          typeof payload.message === "string"
            ? payload.message
            : Array.isArray(payload.message)
              ? payload.message.join(" ")
              : "Unable to save labor billing draft."
        );
        return;
      }

      if (payload.id) {
        router.push(buildHref({ draftId: payload.id }));
      } else {
        router.refresh();
      }
    } finally {
      setIsSavingDraft(false);
    }
  }

  return (
    <div className="space-y-6">
      <PayrollSourceCallout emphasized />

      <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Workweek and scope</h2>
            <p className="mt-1 text-xs text-slate-500">
              Preview and exports use approved clock time for the selected company, week, and filters.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={buildHref({ weekStart: previousWeekStart })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              Previous week
            </Link>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-900">
              {formatDateKeyLabel(preview.periodStart)} → {formatDateKeyLabel(preview.periodEnd)}
            </span>
            <Link
              href={buildHref({ weekStart: nextWeekStart })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              Next week
            </Link>
            <Link
              href={buildHref({ weekStart: thisWeekStart })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              This week
            </Link>
            <span className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${weekStatusBadgeClass(preview.weekStatus)}`}>
              {preview.weekStatus}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {companies.length > 1 ? (
            <FilterSelect
              label="Company"
              value={selectedCompany.id}
              onChange={(value) => router.push(buildHref({ companyId: value }))}
              options={companies.map((company) => ({ id: company.id, name: company.name }))}
            />
          ) : null}
          <FilterSelect
            label="Service client"
            value={initialServiceClientId}
            onChange={(value) => router.push(buildHref({ serviceClientId: value }))}
            options={[{ id: "", name: "All clients" }, ...serviceClients.map((c) => ({ id: c.id, name: c.name }))]}
          />
          <FilterSelect
            label="Location"
            value={initialLocationId}
            onChange={(value) => router.push(buildHref({ locationId: value }))}
            options={[{ id: "", name: "All locations" }, ...locations.map((l) => ({ id: l.id, name: l.name }))]}
          />
          {canManageCompany ? (
            <FilterSelect
              label="Employee"
              value={initialEmployeeId}
              onChange={(value) => router.push(buildHref({ employeeId: value }))}
              options={[{ id: "", name: "All employees" }, ...employees.map((e) => ({ id: e.id, name: e.fullName }))]}
            />
          ) : null}
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={initialOnlyClosedWeeks}
              onChange={(event) => router.push(buildHref({ onlyClosedWeeks: event.target.checked }))}
            />
            Only closed weeks
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Approved time summary</h2>
            <p className="mt-1 text-xs text-slate-500">{preview.dataSourceLabel}</p>
            {preview.snapshotVersion ? (
              <p className="mt-0.5 text-xs text-slate-400">Snapshot version v{preview.snapshotVersion}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={buildLaborCsvHref("payroll", selectedCompany.id, preview.filters)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
            >
              Export payroll CSV
            </a>
            <a
              href={buildLaborCsvHref("client-billing", selectedCompany.id, preview.filters)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
            >
              Export client billing CSV
            </a>
          </div>
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Approved shifts" value={String(preview.totals.approvedShiftCount)} />
          <SummaryCard label="Payable time" value={formatPayableHours(preview.totals.payableMinutes)} />
          <SummaryCard
            label="Employee gross estimate"
            value={formatLaborMoney(preview.totals.employeeGrossEstimateMinor, preview.currencyCode)}
          />
          <SummaryCard
            label="Client labor estimate"
            value={formatLaborMoney(preview.totals.clientLaborEstimateMinor, preview.currencyCode)}
          />
        </dl>
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {LABOR_BILLING_DRAFT_SNAPSHOT_COPY}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSaveDraft()}
            disabled={isSavingDraft}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingDraft ? "Saving draft…" : "Save draft"}
          </button>
          {draftActionError ? (
            <p className="text-sm text-red-700">{draftActionError}</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Saved drafts</h2>
            <p className="mt-1 text-xs text-slate-500">
              Reopen a saved snapshot or export CSV files without recalculating from live data.
            </p>
          </div>
          {initialDraftId ? (
            <Link
              href={buildHref({ draftId: null })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Clear selected draft
            </Link>
          ) : null}
        </div>
        {drafts.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No saved drafts yet for this company.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {drafts.map((draft) => {
              const isSelected = draft.id === initialDraftId;
              return (
                <li
                  key={draft.id}
                  className={`rounded-lg border px-3 py-3 text-sm ${
                    isSelected
                      ? "border-slate-900 bg-slate-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">
                        {formatDateKeyLabel(draft.periodStart)} → {formatDateKeyLabel(draft.periodEnd)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Saved {new Date(draft.createdAt).toLocaleString()} by{" "}
                        {draft.createdBy.fullName ?? "Unknown user"} · {draft.totals.approvedShiftCount}{" "}
                        shifts · {formatPayableHours(draft.totals.payableMinutes)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={buildHref({ draftId: draft.id, weekStart: draft.periodStart })}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                      >
                        {isSelected ? "Selected" : "Open draft"}
                      </Link>
                      <a
                        href={buildLaborDraftCsvHref("payroll", selectedCompany.id, draft.id)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
                      >
                        Export payroll CSV
                      </a>
                      <a
                        href={buildLaborDraftCsvHref("client-billing", selectedCompany.id, draft.id)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
                      >
                        Export client billing CSV
                      </a>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selectedDraft ? (
        <section className="space-y-4 rounded-xl border border-slate-300 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Selected draft snapshot</h2>
              <p className="mt-1 text-xs text-slate-500">
                Frozen on {new Date(selectedDraft.snapshot.generatedAt).toLocaleString()} by{" "}
                {selectedDraft.snapshot.generatedByName ?? "Unknown user"} · {selectedDraft.snapshot.dataSourceLabel}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={buildLaborDraftCsvHref("payroll", selectedCompany.id, selectedDraft.id)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
              >
                Export payroll CSV
              </a>
              <a
                href={buildLaborDraftCsvHref("client-billing", selectedCompany.id, selectedDraft.id)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
              >
                Export client billing CSV
              </a>
            </div>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Approved shifts (snapshot)"
              value={String(selectedDraft.snapshot.totals.approvedShiftCount)}
            />
            <SummaryCard
              label="Payable time (snapshot)"
              value={formatPayableHours(selectedDraft.snapshot.totals.payableMinutes)}
            />
            <SummaryCard
              label="Employee gross (snapshot)"
              value={formatLaborMoney(
                selectedDraft.snapshot.totals.employeeGrossEstimateMinor,
                selectedDraft.snapshot.currencyCode
              )}
            />
            <SummaryCard
              label="Client labor (snapshot)"
              value={formatLaborMoney(
                selectedDraft.snapshot.totals.clientLaborEstimateMinor,
                selectedDraft.snapshot.currencyCode
              )}
            />
          </dl>
          {selectedDraft.snapshot.employeePayPrep.length > 0 ? (
            <DataTable
              columns={["Employee", "Client", "Location", "Approved minutes", "Rate", "Gross estimate"]}
              rows={selectedDraft.snapshot.employeePayPrep.map((row) => [
                row.employeeName,
                row.serviceClientName,
                row.locationName,
                `${row.approvedPayableMinutes} (${row.approvedPayableHoursDecimal}h)`,
                formatLaborRate(row.employeeRateMinor, selectedDraft.snapshot.currencyCode),
                formatLaborMoney(row.estimatedGrossPayMinor, selectedDraft.snapshot.currencyCode)
              ])}
            />
          ) : null}
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Operational work context</h2>
            <p className="mt-1 text-xs text-slate-500">{LABOR_WORK_LOG_DISCLAIMER}</p>
          </div>
          <Link
            href={buildLaborWorkContextHref({
              companyId: selectedCompany.id,
              periodStart: preview.periodStart,
              periodEnd: preview.periodEnd,
              ...(initialServiceClientId ? { serviceClientId: initialServiceClientId } : {}),
              ...(initialLocationId ? { locationId: initialLocationId } : {})
            })}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
          >
            View Labor Work Log
          </Link>
        </div>
        {workContextSummary.total > 0 ? (
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Work assignments" value={String(workContextSummary.total)} />
            <SummaryCard label="Completed" value={String(workContextSummary.completed)} />
            <SummaryCard label="Blocked" value={String(workContextSummary.blocked)} />
            <SummaryCard label="In progress" value={String(workContextSummary.inProgress)} />
          </dl>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            No operational work assignments match the selected week and filters.
          </p>
        )}
      </section>

      {preview.excludedShifts.length > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">Excluded shifts</h2>
          <p className="mt-1 text-sm text-amber-800">
            These shifts are not included in pay prep or client billing totals.
          </p>
          <ul className="mt-3 space-y-2">
            {preview.excludedShifts.map((item) => (
              <li key={item.shiftId} className="rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm text-slate-700">
                <p className="font-medium text-slate-900">
                  {item.employeeName} · {item.locationName}
                </p>
                <p className="mt-1 text-xs text-slate-500">{item.message}</p>
                <Link
                  href={`/review?companyId=${selectedCompany.id}&weekStart=${initialWeekStart}`}
                  className="mt-2 inline-block text-xs font-medium text-slate-900 underline"
                >
                  Open Approvals
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Employee pay prep</h2>
          <p className="text-xs text-slate-500">{EMPLOYEE_PAY_DISCLAIMER}</p>
        </div>
        {preview.employeePayPrep.length === 0 ? (
          <EmptyState
            message={
              initialOnlyClosedWeeks
                ? "No closed-week snapshot matches the current filters. Uncheck “Only closed weeks” or close the week in Weekly Close."
                : preview.totals.approvedShiftCount === 0
                  ? "No approved payable hours for this workweek. Approve shifts in Approvals or try a different week."
                  : "No approved payable hours match the current filters."
            }
            {...(preview.totals.approvedShiftCount === 0
              ? {
                  actionHref: `/review?companyId=${selectedCompany.id}&weekStart=${initialWeekStart}`,
                  actionLabel: "Open Approvals"
                }
              : {})}
          />
        ) : (
          <DataTable
            columns={["Employee", "Client", "Location", "Approved minutes", "Rate", "Gross estimate"]}
            rows={preview.employeePayPrep.map((row) => [
              row.employeeName,
              row.serviceClientName,
              row.locationName,
              `${row.approvedPayableMinutes} (${row.approvedPayableHoursDecimal}h)`,
              formatLaborRate(row.employeeRateMinor, preview.currencyCode),
              formatLaborMoney(row.estimatedGrossPayMinor, preview.currencyCode)
            ])}
          />
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Client labor billing</h2>
          <p className="text-xs text-slate-500">{CLIENT_BILLING_DISCLAIMER}</p>
        </div>
        {preview.clientLaborBilling.length === 0 ? (
          <EmptyState
            message={
              initialOnlyClosedWeeks
                ? "No closed-week billing rows match the current filters."
                : preview.totals.approvedShiftCount === 0
                  ? "No billable labor rows for this workweek yet. Approved shifts with payable minutes appear here after Approvals."
                  : "No billable labor rows match the current filters."
            }
            {...(preview.totals.approvedShiftCount === 0
              ? {
                  actionHref: `/review?companyId=${selectedCompany.id}&weekStart=${initialWeekStart}`,
                  actionLabel: "Open Approvals"
                }
              : {})}
          />
        ) : (
          <DataTable
            columns={[
              "Service client",
              "Location",
              "Employee",
              "Billable minutes",
              "Client rate",
              "Charge estimate",
              "Margin"
            ]}
            rows={preview.clientLaborBilling.map((row) => [
              row.serviceClientName,
              row.locationName,
              row.employeeName,
              `${row.approvedBillableMinutes} (${row.approvedBillableHoursDecimal}h)`,
              formatLaborRate(row.clientLaborRateMinor, preview.currencyCode),
              formatLaborMoney(row.estimatedClientChargeMinor, preview.currencyCode),
              formatLaborMoney(row.estimatedMarginMinor, preview.currencyCode)
            ])}
          />
        )}
      </section>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; name: string }>;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label className="block text-sm text-slate-600" htmlFor={id}>
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">{label}</span>
      <select
        id={id}
        className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.id || "all"} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3">
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function EmptyState({
  message,
  actionHref,
  actionLabel
}: {
  message: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
      <p className="text-sm text-slate-500">{message}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/20">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-100 transition hover:bg-slate-50/80">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`px-4 py-3 ${cellIndex === 0 ? "font-medium text-slate-900" : "text-slate-700"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
