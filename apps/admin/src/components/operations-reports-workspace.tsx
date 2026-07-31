"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { CompanyRecord } from "../lib/employee-utils";
import {
  formatInvoiceStatusLabel,
  formatOperationsReportMoney,
  formatWorkOrderStatusSummaryLabel,
  hasOperationsReportActivity,
  OPERATIONS_REPORTS_DISCLAIMER,
  operationsReportsEmptyMessage,
  type OperationsReportDateRangeQuery,
  type OperationsSummaryReport
} from "../lib/operations-reports-utils";

type OperationsReportsWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly report: OperationsSummaryReport;
  readonly initialRange: OperationsReportDateRangeQuery;
};

const VEHICLE_JOB_KPI_CARDS = [
  { key: "completedVehicles", label: "Vehicles processed" },
  { key: "completedWorkOrders", label: "Work orders completed" },
  { key: "completedServiceLines", label: "Services completed" },
  { key: "pendingWorkOrderCount", label: "Pending work orders" },
  { key: "inProgressWorkOrderCount", label: "In-progress work orders" },
  { key: "uninvoicedCompletedWorkOrderCount", label: "Uninvoiced completed work" }
] as const;

const BILLING_KPI_CARDS = [
  { key: "issuedInvoiceCount", label: "Invoices issued" },
  { key: "voidInvoiceCount", label: "Invoices voided" }
] as const;

export function OperationsReportsWorkspace({
  companies,
  selectedCompany,
  report,
  initialRange
}: OperationsReportsWorkspaceProps) {
  const router = useRouter();
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const showEmptyState = !hasOperationsReportActivity(report);

  function applyRange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRangeError(null);

    if (!from || !to) {
      setRangeError("Both from and to dates are required.");
      return;
    }

    if (from > to) {
      setRangeError("From date must be on or before to date.");
      return;
    }

    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    if (companies.length > 1) {
      params.set("companyId", selectedCompany.id);
    }

    router.push(`/reports?${params.toString()}`);
  }

  return (
    <div className="space-y-8">
      <p className="stitch-card px-4 py-3 text-sm leading-relaxed text-slate-600">
        {OPERATIONS_REPORTS_DISCLAIMER}
      </p>

      <form
        onSubmit={applyRange}
        className="stitch-card p-4"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Date range</h2>
            <p className="mt-1 text-xs text-slate-500">{report.dateRange.timezoneNote}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="text-sm text-slate-600">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">From</span>
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="stitch-input"
              />
            </label>
            <label className="text-sm text-slate-600">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">To</span>
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="stitch-input"
              />
            </label>
            <button
              type="submit"
              className="stitch-btn-primary"
            >
              Apply range
            </button>
          </div>
        </div>
        {rangeError ? <p className="mt-3 text-sm text-red-600">{rangeError}</p> : null}
      </form>

      {showEmptyState ? (
        <div className="stitch-card p-6 text-sm text-slate-600">
          <p className="font-medium text-slate-900">{operationsReportsEmptyMessage(true).title}</p>
          <p className="mt-2">{operationsReportsEmptyMessage(true).description}</p>
        </div>
      ) : null}

      <ReportSection
        title="Vehicle and job reports"
        description="Operational throughput for vehicles, work orders, and services in the selected range."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {VEHICLE_JOB_KPI_CARDS.map((card) => (
            <KpiCard key={card.key} label={card.label} value={String(report.kpis[card.key])} />
          ))}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <SnapshotCard title="Work order status" description="Current company snapshot">
            <ul className="space-y-2">
              {report.workOrderStatusSummary.map((row) => (
                <li key={row.status} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{formatWorkOrderStatusSummaryLabel(row.status)}</span>
                  <span className="font-medium text-slate-900">{row.count}</span>
                </li>
              ))}
            </ul>
          </SnapshotCard>

          <SnapshotCard title="Pending work" description="Completed work still awaiting invoice">
            <p className="text-sm text-slate-600">
              {report.pendingWork.pendingWorkOrderCount} pending · {report.pendingWork.inProgressWorkOrderCount} in
              progress · {report.pendingWork.uninvoicedCompletedWorkOrderCount} completed but not invoiced
            </p>
            {report.pendingWork.sampleUninvoicedWorkOrders.length > 0 ? (
              <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Work order</th>
                      <th className="px-4 py-3 font-medium">Client</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {report.pendingWork.sampleUninvoicedWorkOrders.map((workOrder) => (
                      <tr key={workOrder.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{workOrder.workOrderNumber}</td>
                        <td className="px-4 py-3 text-slate-600">{workOrder.serviceClientName}</td>
                        <td className="px-4 py-3">
                          <Link href="/client-invoices" className="text-sm font-medium text-slate-900 underline">
                            Create invoice
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">No uninvoiced completed work orders right now.</p>
            )}
          </SnapshotCard>
        </div>

        <div className="mt-5 space-y-5">
          <ReportTableSection
            title="Top service clients"
            description="Completed work and issued invoice revenue in the selected range."
            columns={["Client", "Work orders", "Services", "Invoices", "Revenue"]}
            rows={report.serviceClients.slice(0, 10).map((row) => [
              row.serviceClientName,
              String(row.completedWorkOrderCount),
              String(row.completedServiceLineCount),
              String(row.issuedInvoiceCount),
              formatOperationsReportMoney(row.revenueMinor, report.currencyCode)
            ])}
            emptyMessage="No service client activity in this range."
          />

          <ReportTableSection
            title="Top services"
            description="Service completions and invoiced line revenue in the selected range."
            columns={["Service", "Category", "Completed", "Revenue"]}
            rows={report.services.slice(0, 10).map((row) => [
              row.serviceName,
              row.serviceCategory ?? "—",
              String(row.completedCount),
              formatOperationsReportMoney(row.revenueMinor, report.currencyCode)
            ])}
            emptyMessage="No service completions in this range."
          />
        </div>
      </ReportSection>

      <ReportSection
        title="Labor reports"
        description="Operational productivity counts — not payroll, pay rates, or approved clock time."
      >
        <ReportTableSection
          title="Employee productivity"
          description="Services completed, assignments, and responsibility scans in the selected range."
          columns={["Employee", "Services completed", "Assignments", "Responsibility scans"]}
          rows={report.employees.slice(0, 10).map((row) => [
            row.employeeName,
            String(row.completedServiceLineCount),
            String(row.assignedWorkOrderCount),
            String(row.responsibilityConfirmedCount)
          ])}
          emptyMessage="No employee productivity activity in this range."
        />
      </ReportSection>

      <ReportSection
        title="Billing reports"
        description="Issued invoice activity and revenue in the selected range — separate from labor billing previews."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {BILLING_KPI_CARDS.map((card) => (
            <KpiCard key={card.key} label={card.label} value={String(report.kpis[card.key])} />
          ))}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <SnapshotCard title="Revenue summary" description="Issued and voided invoice totals in range">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Issued in range</dt>
                <dd className="font-medium text-slate-900">
                  {formatOperationsReportMoney(report.revenue.invoicedRevenueMinor, report.currencyCode)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Voided in range</dt>
                <dd className="font-medium text-slate-900">
                  {formatOperationsReportMoney(report.revenue.voidedRevenueMinor, report.currencyCode)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <dt className="font-medium text-slate-700">Net issued revenue</dt>
                <dd className="text-base font-semibold text-slate-900">
                  {formatOperationsReportMoney(report.revenue.netIssuedRevenueMinor, report.currencyCode)}
                </dd>
              </div>
            </dl>
          </SnapshotCard>

          <SnapshotCard title="Invoice status" description="Current company snapshot">
            <ul className="space-y-2">
              {report.invoiceStatusSummary.map((row) => (
                <li key={row.status} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{formatInvoiceStatusLabel(row.status)}</span>
                    <span className="font-medium text-slate-900">{row.count}</span>
                  </div>
                  {row.totalMinor > 0 ? (
                    <p className="text-xs text-slate-400">
                      {formatOperationsReportMoney(row.totalMinor, report.currencyCode)} total
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </SnapshotCard>
        </div>
      </ReportSection>
    </div>
  );
}

function ReportSection({
  title,
  description,
  children
}: {
  readonly title: string;
  readonly description: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="stitch-card p-5">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function KpiCard({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <article className="stitch-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
    </article>
  );
}

function SnapshotCard({
  title,
  description,
  children
}: {
  readonly title: string;
  readonly description: string;
  readonly children: React.ReactNode;
}) {
  return (
    <article className="stitch-card p-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      <div className="mt-4">{children}</div>
    </article>
  );
}

type ReportTableSectionProps = {
  readonly title: string;
  readonly description: string;
  readonly columns: string[];
  readonly rows: string[][];
  readonly emptyMessage: string;
};

function ReportTableSection({ title, description, columns, rows, emptyMessage }: ReportTableSectionProps) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {columns.map((column) => (
                    <th key={column} className="px-4 py-3 font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {rows.map((row, index) => (
                  <tr key={`${title}-${index}`}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`${title}-${index}-${cellIndex}`}
                        className={`px-4 py-3 ${cellIndex === 0 ? "font-medium text-slate-900" : "text-slate-600"}`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 space-y-3 md:hidden">
            {rows.map((row, index) => (
              <article key={`${title}-card-${index}`} className="rounded-lg border border-slate-200 p-4">
                <p className="font-medium text-slate-900">{row[0]}</p>
                <dl className="mt-3 space-y-2 text-sm">
                  {columns.slice(1).map((column, columnIndex) => (
                    <div key={column} className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500">{column}</dt>
                      <dd className="font-medium text-slate-900">{row[columnIndex + 1]}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
