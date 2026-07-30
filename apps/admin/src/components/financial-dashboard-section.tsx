"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildFinancialQuery,
  collectedEmptyMessage,
  FINANCIAL_KPI_DEFINITIONS,
  FINANCIAL_PERIOD_PRESETS,
  financialSummaryPath,
  financialTrendsPath,
  formatFinancialMoney,
  formatPaymentMethodLabel,
  formatPercentageChange,
  overdueEmptyMessage,
  outstandingEmptyMessage,
  recentPaymentsPath,
  salesEmptyMessage,
  topDebtorsPath,
  type FinancialPeriodPreset,
  type FinancialSummaryResponse,
  type FinancialTrendsResponse,
  type RecentPaymentsResponse,
  type TopDebtorsResponse
} from "../lib/financial-dashboard-utils";
import { formatClientInvoiceDate } from "../lib/client-invoice-utils";
import { MaterialIcon } from "./ui/material-icon";

type FinancialDashboardSectionProps = {
  readonly companyId: string;
  readonly companyName: string;
  readonly canManageCompany: boolean;
  readonly companies?: Array<{ id: string; name: string }>;
};

type LoadState = "idle" | "loading" | "ready" | "error";

function KpiCard({
  title,
  amountLabel,
  countLabel,
  changeLabel,
  emptyLabel,
  tone,
  definition,
  badge,
  onClick
}: {
  readonly title: string;
  readonly amountLabel: string;
  readonly countLabel: string;
  readonly changeLabel: string | null;
  readonly emptyLabel: string | null;
  readonly tone: "sales" | "collected" | "outstanding" | "overdue";
  readonly definition: string;
  readonly badge?: string | null;
  readonly onClick?: () => void;
}) {
  const toneClasses = {
    sales: "border-blue-200/80 bg-blue-50/40",
    collected: "border-emerald-200/80 bg-emerald-50/40",
    outstanding: "border-amber-200/80 bg-amber-50/40",
    overdue: "border-red-200/80 bg-red-50/40"
  } as const;

  const valueClasses = {
    sales: "text-blue-700",
    collected: "text-emerald-700",
    outstanding: "text-amber-800",
    overdue: "text-red-700"
  } as const;

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="stitch-label">{title}</p>
        {badge ? (
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">
            {badge}
          </span>
        ) : null}
      </div>
      <p className={`mt-3 font-display text-3xl font-semibold tracking-tight ${valueClasses[tone]}`}>
        {amountLabel}
      </p>
      <p className="mt-2 text-xs text-on-surface-variant">{countLabel}</p>
      {changeLabel ? (
        <p className="mt-1 text-xs font-medium text-on-surface-variant">vs prior: {changeLabel}</p>
      ) : null}
      {emptyLabel ? <p className="mt-2 text-xs text-on-surface-variant">{emptyLabel}</p> : null}
    </>
  );

  const className = `rounded-xl border p-5 text-left ${toneClasses[tone]} ${
    onClick ? "cursor-pointer transition hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500" : ""
  }`;

  if (onClick) {
    return (
      <button type="button" className={className} title={definition} onClick={onClick} aria-label={`${title}. ${definition}`}>
        {content}
      </button>
    );
  }

  return (
    <article className={className} title={definition} aria-label={`${title}. ${definition}`}>
      {content}
    </article>
  );
}

function TrendsChart({
  series,
  currencyCode
}: {
  readonly series: FinancialTrendsResponse["series"];
  readonly currencyCode: string;
}) {
  const maxValue = Math.max(1, ...series.flatMap((point) => [point.salesMinor, point.collectedMinor]));
  const width = 640;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 36, left: 48 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  if (series.length === 0 || series.every((point) => point.salesMinor === 0 && point.collectedMinor === 0)) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-on-surface-variant">
        No sales or collections in this period
      </div>
    );
  }

  const step = series.length > 1 ? plotWidth / (series.length - 1) : plotWidth;
  const toX = (index: number) => padding.left + index * step;
  const toY = (value: number) => padding.top + plotHeight - (value / maxValue) * plotHeight;

  const salesPath = series
    .map((point, index) => `${index === 0 ? "M" : "L"} ${toX(index)} ${toY(point.salesMinor)}`)
    .join(" ");
  const collectedPath = series
    .map((point, index) => `${index === 0 ? "M" : "L"} ${toX(index)} ${toY(point.collectedMinor)}`)
    .join(" ");

  const labelIndexes =
    series.length <= 8
      ? series.map((_, index) => index)
      : [0, Math.floor(series.length / 2), series.length - 1];

  return (
    <div className="overflow-x-auto">
      <svg
        role="img"
        aria-label={`Sales and collections chart in ${currencyCode}`}
        viewBox={`0 0 ${width} ${height}`}
        className="h-56 w-full min-w-[320px]"
      >
        <title>Sales and collections</title>
        {[0, 0.5, 1].map((ratio) => {
          const y = toY(maxValue * ratio);
          return (
            <g key={ratio}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-slate-400" fontSize="10">
                {formatFinancialMoney(Math.round(maxValue * ratio), currencyCode)}
              </text>
            </g>
          );
        })}
        <path d={salesPath} fill="none" stroke="#2563eb" strokeWidth="2.5" />
        <path d={collectedPath} fill="none" stroke="#059669" strokeWidth="2.5" />
        {series.map((point, index) => (
          <g key={point.period}>
            <circle cx={toX(index)} cy={toY(point.salesMinor)} r="3" fill="#2563eb">
              <title>{`${point.period} sales ${formatFinancialMoney(point.salesMinor, currencyCode)}`}</title>
            </circle>
            <circle cx={toX(index)} cy={toY(point.collectedMinor)} r="3" fill="#059669">
              <title>{`${point.period} collected ${formatFinancialMoney(point.collectedMinor, currencyCode)}`}</title>
            </circle>
          </g>
        ))}
        {labelIndexes.map((index) => (
          <text
            key={`label-${series[index]?.period ?? index}`}
            x={toX(index)}
            y={height - 12}
            textAnchor="middle"
            className="fill-slate-500"
            fontSize="10"
          >
            {series[index]?.period}
          </text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-on-surface-variant">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-600" aria-hidden /> Sales
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" aria-hidden /> Collected
        </span>
      </div>
    </div>
  );
}

export function FinancialDashboardSection({
  companyId,
  companyName,
  canManageCompany,
  companies = []
}: FinancialDashboardSectionProps) {
  const [preset, setPreset] = useState<FinancialPeriodPreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [summary, setSummary] = useState<FinancialSummaryResponse | null>(null);
  const [trends, setTrends] = useState<FinancialTrendsResponse | null>(null);
  const [debtors, setDebtors] = useState<TopDebtorsResponse | null>(null);
  const [payments, setPayments] = useState<RecentPaymentsResponse | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [overdueOpen, setOverdueOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const requestIdRef = useRef(0);

  const query = useMemo(
    () =>
      buildFinancialQuery({
        preset,
        from: customFrom,
        to: customTo,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }),
    [preset, customFrom, customTo]
  );

  useEffect(() => {
    if (!canManageCompany) {
      return;
    }

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;

    setState("loading");
    setErrorMessage(null);
    setSummary(null);
    setTrends(null);
    setDebtors(null);
    setPayments(null);
    setOverdueOpen(false);

    async function load() {
      try {
        const [summaryRes, trendsRes, debtorsRes, paymentsRes] = await Promise.all([
          fetch(financialSummaryPath(companyId, query), { signal: controller.signal, cache: "no-store" }),
          fetch(financialTrendsPath(companyId, query), { signal: controller.signal, cache: "no-store" }),
          fetch(topDebtorsPath(companyId), { signal: controller.signal, cache: "no-store" }),
          fetch(recentPaymentsPath(companyId), { signal: controller.signal, cache: "no-store" })
        ]);

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (!summaryRes.ok || !trendsRes.ok || !debtorsRes.ok || !paymentsRes.ok) {
          const failed = [summaryRes, trendsRes, debtorsRes, paymentsRes].find((response) => !response.ok);
          const payload = failed ? ((await failed.json().catch(() => ({}))) as { message?: string }) : {};
          throw new Error(payload.message ?? "Unable to load financial dashboard.");
        }

        const [summaryJson, trendsJson, debtorsJson, paymentsJson] = await Promise.all([
          summaryRes.json() as Promise<FinancialSummaryResponse>,
          trendsRes.json() as Promise<FinancialTrendsResponse>,
          debtorsRes.json() as Promise<TopDebtorsResponse>,
          paymentsRes.json() as Promise<RecentPaymentsResponse>
        ]);

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (
          summaryJson.companyId !== companyId ||
          trendsJson.companyId !== companyId ||
          debtorsJson.companyId !== companyId ||
          paymentsJson.companyId !== companyId
        ) {
          return;
        }

        setSummary(summaryJson);
        setTrends(trendsJson);
        setDebtors(debtorsJson);
        setPayments(paymentsJson);
        setState("ready");
      } catch (error) {
        if (controller.signal.aborted || requestId !== requestIdRef.current) {
          return;
        }
        setState("error");
        setErrorMessage(error instanceof Error ? error.message : "Unable to load financial dashboard.");
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [canManageCompany, companyId, query, reloadToken]);

  if (!canManageCompany) {
    return null;
  }

  const currencyCode = summary?.currencyCode ?? "USD";

  return (
    <section className="space-y-5" aria-labelledby="financial-dashboard-heading">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="financial-dashboard-heading" className="stitch-section-title text-body-sm">
            Financial overview
          </h2>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Sales, collections, and receivables for {companyName}.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          {companies.length > 1 ? (
            <label className="text-xs text-on-surface-variant">
              <span className="mb-1 block font-medium uppercase tracking-wide">Company</span>
              <select
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-on-surface"
                value={companyId}
                onChange={(event) => {
                  const next = event.target.value;
                  if (next && next !== companyId) {
                    window.location.href = `/?companyId=${encodeURIComponent(next)}`;
                  }
                }}
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="flex flex-wrap gap-2" role="group" aria-label="Period">
            {FINANCIAL_PERIOD_PRESETS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPreset(option.value)}
                className={`rounded-lg px-3 py-2 text-xs font-medium ${
                  preset === option.value
                    ? "bg-primary text-white"
                    : "border border-slate-200 bg-white text-on-surface-variant"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {preset === "custom" ? (
            <div className="flex gap-2">
              <label className="text-xs text-on-surface-variant">
                From
                <input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-on-surface-variant">
                To
                <input
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
            </div>
          ) : null}
        </div>
      </div>

      {state === "loading" || state === "idle" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : null}

      {state === "error" ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{errorMessage}</p>
          <button
            type="button"
            className="mt-2 text-sm font-medium underline"
            onClick={() => setReloadToken((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      ) : null}

      {state === "ready" && summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Sales"
              amountLabel={formatFinancialMoney(summary.sales.amountMinor, currencyCode)}
              countLabel={`${summary.sales.invoiceCount} invoice${summary.sales.invoiceCount === 1 ? "" : "s"}`}
              changeLabel={formatPercentageChange(summary.sales.percentageChange)}
              emptyLabel={salesEmptyMessage(summary.sales.amountMinor)}
              tone="sales"
              definition={FINANCIAL_KPI_DEFINITIONS.sales}
            />
            <KpiCard
              title="Collected"
              amountLabel={formatFinancialMoney(summary.collected.amountMinor, currencyCode)}
              countLabel={`${summary.collected.paymentCount} payment${summary.collected.paymentCount === 1 ? "" : "s"}`}
              changeLabel={formatPercentageChange(summary.collected.percentageChange)}
              emptyLabel={collectedEmptyMessage(summary.collected.amountMinor)}
              tone="collected"
              definition={FINANCIAL_KPI_DEFINITIONS.collected}
            />
            <KpiCard
              title="Outstanding"
              amountLabel={formatFinancialMoney(summary.outstanding.amountMinor, currencyCode)}
              countLabel={`${summary.outstanding.invoiceCount} invoice${summary.outstanding.invoiceCount === 1 ? "" : "s"}`}
              changeLabel={null}
              emptyLabel={outstandingEmptyMessage(summary.outstanding.amountMinor)}
              tone="outstanding"
              definition={FINANCIAL_KPI_DEFINITIONS.outstanding}
            />
            <KpiCard
              title="Overdue"
              amountLabel={formatFinancialMoney(summary.overdue.amountMinor, currencyCode)}
              countLabel={`${summary.overdue.invoiceCount} invoice${summary.overdue.invoiceCount === 1 ? "" : "s"}`}
              changeLabel={null}
              emptyLabel={overdueEmptyMessage(summary.overdue.invoiceCount)}
              tone="overdue"
              definition={FINANCIAL_KPI_DEFINITIONS.overdue}
              badge={summary.overdue.invoiceCount > 0 ? String(summary.overdue.invoiceCount) : null}
              onClick={() => setOverdueOpen(true)}
            />
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/20">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-on-surface">Sales vs collections</h3>
                <p className="text-xs text-on-surface-variant">
                  {summary.period.from} → {summary.period.to}
                </p>
              </div>
              <Link href="/reports" className="text-xs font-medium text-primary hover:underline">
                View full report
              </Link>
            </div>
            <TrendsChart series={trends?.series ?? []} currencyCode={currencyCode} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/20">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-on-surface">Top debtors</h3>
                <Link href="/client-invoices?status=ISSUED" className="text-xs font-medium text-primary hover:underline">
                  View all
                </Link>
              </div>
              {(debtors?.debtors.length ?? 0) === 0 ? (
                <p className="text-sm text-on-surface-variant">No outstanding invoices</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {debtors?.debtors.map((debtor) => (
                    <li key={debtor.serviceClientId} className="flex items-start justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-medium text-on-surface">{debtor.serviceClientName}</p>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          {debtor.invoiceCount} invoice{debtor.invoiceCount === 1 ? "" : "s"}
                          {debtor.oldestDueDate
                            ? ` · oldest due ${formatClientInvoiceDate(debtor.oldestDueDate)}`
                            : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-on-surface">
                          {formatFinancialMoney(debtor.outstandingAmountMinor, debtor.currencyCode)}
                        </p>
                        {debtor.overdueAmountMinor > 0 ? (
                          <p className="mt-1 text-xs font-medium text-red-600">
                            Overdue {formatFinancialMoney(debtor.overdueAmountMinor, debtor.currencyCode)}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/20">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-on-surface">Recent payments</h3>
                <Link href="/reports" className="text-xs font-medium text-primary hover:underline">
                  View report
                </Link>
              </div>
              {(payments?.payments.length ?? 0) === 0 ? (
                <p className="text-sm text-on-surface-variant">No payments received in this period</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {payments?.payments.map((payment) => (
                    <li key={payment.paymentId} className="flex items-start justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-medium text-on-surface">{payment.clientName}</p>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          {payment.invoiceNumber ?? payment.invoiceId.slice(0, 8)} ·{" "}
                          {formatPaymentMethodLabel(payment.method)} · {payment.status}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-emerald-700">
                          {formatFinancialMoney(payment.amountMinor, payment.currencyCode)}
                        </p>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          {formatClientInvoiceDate(payment.receivedAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}

      {overdueOpen && summary ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="overdue-drawer-title"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="overdue-drawer-title" className="text-lg font-semibold text-on-surface">
                  Overdue receivables
                </h3>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {formatFinancialMoney(summary.overdue.amountMinor, currencyCode)} across{" "}
                  {summary.overdue.invoiceCount} invoice{summary.overdue.invoiceCount === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                onClick={() => setOverdueOpen(false)}
              >
                Close
              </button>
            </div>

            {(debtors?.debtors.filter((debtor) => debtor.overdueAmountMinor > 0).length ?? 0) === 0 ? (
              <p className="mt-4 text-sm text-on-surface-variant">No overdue invoices</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {debtors?.debtors
                  .filter((debtor) => debtor.overdueAmountMinor > 0)
                  .map((debtor) => (
                    <li key={debtor.serviceClientId} className="py-3">
                      <p className="text-sm font-medium text-on-surface">{debtor.serviceClientName}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {debtor.overdueInvoiceCount} overdue ·{" "}
                        {formatFinancialMoney(debtor.overdueAmountMinor, debtor.currencyCode)}
                      </p>
                    </li>
                  ))}
              </ul>
            )}

            <Link
              href="/client-invoices?status=ISSUED"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <MaterialIcon name="receipt_long" className="text-[16px]" />
              View invoices
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}
