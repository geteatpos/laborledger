"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { PayrollSourceCallout } from "./payroll-source-callout";
import { RateSourceBadge } from "./rate-source-badge";
import type { CompanyRecord } from "../lib/employee-utils";
import { PAY_RATES_APPLIED_COPY } from "../lib/billing-module-copy";
import {
  DEFAULT_CLIENT_LABOR_RATE_USD,
  DEFAULT_EMPLOYEE_RATE_USD,
  formatEffectiveDate,
  formatRateDisplay,
  grossMarginDisclaimerCopy,
  type ClientLaborRateView,
  type EmployeeRateView,
  type LocationLaborRateView
} from "../lib/rate-utils";

type RatesWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly employeeRates: EmployeeRateView[];
  readonly clientLaborRates: ClientLaborRateView[];
  readonly locationLaborRates: LocationLaborRateView[];
};

function RateSectionEmpty({ message }: { readonly message: string }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-sm text-slate-500">
      {message}
    </p>
  );
}

function DesktopRateTable({
  columns,
  rows
}: {
  readonly columns: string[];
  readonly rows: ReactNode[][];
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="hidden overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/30 md:block">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((cells, index) => (
              <tr key={index} className="transition hover:bg-slate-50/80">
                {cells.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-5 py-3.5 text-slate-700">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RatesWorkspace({
  companies,
  selectedCompany,
  employeeRates,
  clientLaborRates,
  locationLaborRates
}: RatesWorkspaceProps) {
  function buildRatesHref(companyId: string) {
    return `/rates?companyId=${companyId}`;
  }

  return (
    <>
      <div className="mb-6 space-y-4">
        <PayrollSourceCallout />
        <p className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-sm leading-relaxed text-slate-600 shadow-sm shadow-slate-200/20">
          {PAY_RATES_APPLIED_COPY} Amounts are gross-pay and client labor estimates — not tax payroll, issued
          invoices, or payments.
        </p>
      </div>

      {companies.length > 1 ? (
        <div className="mb-6 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Company</p>
          <div className="flex flex-wrap gap-2">
            {companies.map((company) => {
              const isSelected = company.id === selectedCompany.id;
              return (
                <Link
                  key={company.id}
                  href={buildRatesHref(company.id)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    isSelected
                      ? "border-slate-900 bg-slate-900 font-medium text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                  }`}
                >
                  {company.name}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-900">Default rates</h2>
        <p className="mt-1 text-sm text-slate-500">
          Applied when employees and service clients are created. Overrides use effective-dated records.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/20">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Employee pay rate</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">${DEFAULT_EMPLOYEE_RATE_USD.toFixed(2)}/hr</p>
            <p className="mt-1 text-xs text-slate-500">Default hourly input for payroll preview</p>
          </article>
          <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/20">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Client billing rate</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">${DEFAULT_CLIENT_LABOR_RATE_USD.toFixed(2)}/hr</p>
            <p className="mt-1 text-xs text-slate-500">Default internal charge estimate per service client</p>
          </article>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-900">Employee pay rates</h2>
        <p className="mt-1 text-sm text-slate-500">Current effective gross-pay inputs by employee.</p>
        <div className="mt-4 space-y-4">
          {employeeRates.length === 0 ? (
            <RateSectionEmpty message="No active employees with rate records for this company." />
          ) : (
            <>
              <DesktopRateTable
                columns={["Employee", "Rate", "Effective from", "Effective to", "Source"]}
                rows={employeeRates.map((row) => [
                  <span key="name" className="font-medium text-slate-900">
                    {row.employeeName}
                  </span>,
                  formatRateDisplay(row.rateMinorUnits, row.currencyCode),
                  formatEffectiveDate(row.effectiveStart),
                  formatEffectiveDate(row.effectiveEnd),
                  <RateSourceBadge key="source" source={row.source} />
                ])}
              />
              <div className="space-y-3 md:hidden">
                {employeeRates.map((row) => (
                  <article
                    key={row.employeeId}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{row.employeeName}</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {formatRateDisplay(row.rateMinorUnits, row.currencyCode)}
                        </p>
                      </div>
                      <RateSourceBadge source={row.source} />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Effective {formatEffectiveDate(row.effectiveStart)}
                      {row.effectiveEnd ? ` to ${formatEffectiveDate(row.effectiveEnd)}` : " · open-ended"}
                    </p>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-900">Client billing rates</h2>
        <p className="mt-1 text-sm text-slate-500">Current effective internal charge inputs by service client.</p>
        <div className="mt-4 space-y-4">
          {clientLaborRates.length === 0 ? (
            <RateSectionEmpty message="No active service clients with rate records for this company." />
          ) : (
            <>
              <DesktopRateTable
                columns={["Service client", "Billing rate", "Effective from", "Effective to", "Source"]}
                rows={clientLaborRates.map((row) => [
                  <span key="name" className="font-medium text-slate-900">
                    {row.serviceClientName}
                  </span>,
                  formatRateDisplay(row.rateMinorUnits, row.currencyCode),
                  formatEffectiveDate(row.effectiveStart),
                  formatEffectiveDate(row.effectiveEnd),
                  <RateSourceBadge key="source" source={row.source} />
                ])}
              />
              <div className="space-y-3 md:hidden">
                {clientLaborRates.map((row) => (
                  <article
                    key={row.serviceClientId}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{row.serviceClientName}</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {formatRateDisplay(row.rateMinorUnits, row.currencyCode)}
                        </p>
                      </div>
                      <RateSourceBadge source={row.source} />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Effective {formatEffectiveDate(row.effectiveStart)}
                      {row.effectiveEnd ? ` to ${formatEffectiveDate(row.effectiveEnd)}` : " · open-ended"}
                    </p>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {locationLaborRates.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-900">Location billing overrides</h2>
          <p className="mt-1 text-sm text-slate-500">Site-specific internal charge inputs when they differ from client defaults.</p>
          <div className="mt-4 space-y-4">
            <DesktopRateTable
              columns={["Location", "Billing rate", "Effective from", "Effective to", "Source"]}
              rows={locationLaborRates.map((row) => [
                <span key="name" className="font-medium text-slate-900">
                  {row.locationName}
                </span>,
                formatRateDisplay(row.rateMinorUnits, row.currencyCode),
                formatEffectiveDate(row.effectiveStart),
                formatEffectiveDate(row.effectiveEnd),
                <RateSourceBadge key="source" source={row.source} />
              ])}
            />
            <div className="space-y-3 md:hidden">
              {locationLaborRates.map((row) => (
                <article
                  key={row.locationId}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{row.locationName}</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {formatRateDisplay(row.rateMinorUnits, row.currencyCode)}
                      </p>
                    </div>
                    <RateSourceBadge source={row.source} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Effective {formatEffectiveDate(row.effectiveStart)}
                    {row.effectiveEnd ? ` to ${formatEffectiveDate(row.effectiveEnd)}` : " · open-ended"}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
        <h2 className="text-sm font-semibold text-slate-900">How rates combine in billing preview</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{grossMarginDisclaimerCopy()}</p>
        <p className="mt-2 text-xs text-slate-500">
          Closed weeks retain snapshotted rates so historical totals stay reproducible.
        </p>
        <Link
          href="/labor-billing"
          className="mt-3 inline-flex text-sm font-medium text-slate-900 underline"
        >
          Open Labor Billing preview
        </Link>
      </section>
    </>
  );
}
