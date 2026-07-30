"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { LaborWorkStatusBadge } from "./labor-work-status-badge";
import { PayrollSourceCallout } from "./payroll-source-callout";
import type { CompanyRecord } from "../lib/employee-utils";
import { LABOR_WORK_BILLING_CONTEXT_COPY } from "../lib/billing-module-copy";
import {
  buildLaborWorkLogQuery,
  formatLaborWorkDuration,
  type LaborWorkLogItem
} from "../lib/labor-work-log-utils";
import type { EmployeeOption, LocationOption, ServiceClientOption } from "../lib/shift-utils";

type LaborWorkLogWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly items: LaborWorkLogItem[];
  readonly locations: LocationOption[];
  readonly serviceClients: ServiceClientOption[];
  readonly employees: EmployeeOption[];
  readonly canManageCompany: boolean;
  readonly initialLocationId: string;
  readonly initialServiceClientId: string;
  readonly initialEmployeeId: string;
  readonly initialStatus: string;
};

function formatTimestamp(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

function formatWorkDuration(item: LaborWorkLogItem) {
  if (item.referenceServiceMinutes !== null && item.referenceServiceMinutes !== undefined) {
    return formatLaborWorkDuration(item.referenceServiceMinutes);
  }

  if (item.completedAt) {
    const minutes = Math.max(
      0,
      Math.round((new Date(item.completedAt).getTime() - new Date(item.startedAt).getTime()) / 60_000)
    );
    return formatLaborWorkDuration(minutes);
  }

  return "—";
}

export function LaborWorkLogWorkspace({
  companies,
  selectedCompany,
  items,
  locations,
  serviceClients,
  employees,
  canManageCompany,
  initialLocationId,
  initialServiceClientId,
  initialEmployeeId,
  initialStatus
}: LaborWorkLogWorkspaceProps) {
  const router = useRouter();

  function buildHref(overrides: {
    companyId?: string;
    locationId?: string;
    serviceClientId?: string;
    employeeId?: string;
    status?: string;
  }) {
    const params = new URLSearchParams();
    params.set("companyId", overrides.companyId ?? selectedCompany.id);
    const locationId = overrides.locationId ?? initialLocationId;
    if (locationId) params.set("locationId", locationId);
    const serviceClientId = overrides.serviceClientId ?? initialServiceClientId;
    if (serviceClientId) params.set("serviceClientId", serviceClientId);
    const employeeId = overrides.employeeId ?? initialEmployeeId;
    if (employeeId) params.set("employeeId", employeeId);
    const status = overrides.status ?? initialStatus;
    if (status) params.set("status", status);
    return `/labor-work?${params.toString()}`;
  }

  const exportHref = `/api/company-operations/companies/${selectedCompany.id}/labor-work-assignments/export-csv${buildLaborWorkLogQuery(
    {
      ...(initialLocationId ? { locationId: initialLocationId } : {}),
      ...(initialServiceClientId ? { serviceClientId: initialServiceClientId } : {}),
      ...(initialEmployeeId ? { employeeId: initialEmployeeId } : {}),
      ...(initialStatus ? { status: initialStatus } : {})
    }
  )}`;

  return (
    <div className="space-y-6">
      <PayrollSourceCallout emphasized />
      <p className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-sm leading-relaxed text-slate-600 shadow-sm shadow-slate-200/20">
        {LABOR_WORK_BILLING_CONTEXT_COPY}
      </p>

      <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/20">
        <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <FilterField label="Company">
            <select
              value={selectedCompany.id}
              onChange={(event) => router.push(buildHref({ companyId: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Location">
            <select
              value={initialLocationId}
              onChange={(event) => router.push(buildHref({ locationId: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Client">
            <select
              value={initialServiceClientId}
              onChange={(event) => router.push(buildHref({ serviceClientId: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">All clients</option>
              {serviceClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </FilterField>

          {canManageCompany ? (
            <FilterField label="Employee">
              <select
                value={initialEmployeeId}
                onChange={(event) => router.push(buildHref({ employeeId: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">All employees</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName}
                  </option>
                ))}
              </select>
            </FilterField>
          ) : null}

          <FilterField label="Status">
            <select
              value={initialStatus}
              onChange={(event) => router.push(buildHref({ status: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="BLOCKED">Blocked</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </FilterField>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {items.length} {items.length === 1 ? "assignment" : "assignments"} match the current filters.
          </p>
          <Link
            href={exportHref}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Export CSV
          </Link>
        </div>
      </section>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-900">No labor work assignments match the current filters.</p>
          <p className="mt-2 text-sm text-slate-500">
            Work timers appear here as employees complete services in Field. Billing still comes from approved clock
            time in{" "}
            <Link href="/labor-billing" className="font-medium text-slate-900 underline">
              Labor Billing
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Employee", "Client / vehicle", "Service", "Status", "Started", "Completed", "Duration", "Blocked reason"].map(
                    (heading) => (
                      <th key={heading} className="px-4 py-3 font-medium">
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="transition hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-900">{item.employeeName}</td>
                    <td className="px-4 py-3">
                      <p className="text-slate-900">{item.clientName}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{item.address}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.serviceName}</td>
                    <td className="px-4 py-3">
                      <LaborWorkStatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatTimestamp(item.startedAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatTimestamp(item.completedAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatWorkDuration(item)}</td>
                    <td className="max-w-xs px-4 py-3 text-slate-600">{item.blockedReason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{item.employeeName}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.clientName}</p>
                  </div>
                  <LaborWorkStatusBadge status={item.status} />
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <Row label="Service" value={item.serviceName} />
                  <Row label="Started" value={formatTimestamp(item.startedAt)} />
                  <Row label="Completed" value={formatTimestamp(item.completedAt)} />
                  <Row label="Duration" value={formatWorkDuration(item)} />
                  {item.blockedReason ? <Row label="Blocked reason" value={item.blockedReason} /> : null}
                </dl>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}
