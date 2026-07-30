import {
  formatFinancialMoney,
  formatPercentageChange,
  type FinancialSummaryResponse
} from "../lib/financial-dashboard-utils";

type FinancialReportsSummaryProps = {
  readonly summary: FinancialSummaryResponse;
};

export function FinancialReportsSummary({ summary }: FinancialReportsSummaryProps) {
  const currency = summary.currencyCode;
  const cards = [
    {
      key: "sales",
      label: "Sales",
      amount: summary.sales.amountMinor,
      meta: `${summary.sales.invoiceCount} invoices`,
      change: summary.sales.percentageChange,
      className: "border-blue-200 bg-blue-50/50",
      valueClassName: "text-blue-700"
    },
    {
      key: "collected",
      label: "Collected",
      amount: summary.collected.amountMinor,
      meta: `${summary.collected.paymentCount} payments`,
      change: summary.collected.percentageChange,
      className: "border-emerald-200 bg-emerald-50/50",
      valueClassName: "text-emerald-700"
    },
    {
      key: "outstanding",
      label: "Outstanding",
      amount: summary.outstanding.amountMinor,
      meta: `${summary.outstanding.invoiceCount} invoices`,
      change: null,
      className: "border-amber-200 bg-amber-50/50",
      valueClassName: "text-amber-800"
    },
    {
      key: "overdue",
      label: "Overdue",
      amount: summary.overdue.amountMinor,
      meta: `${summary.overdue.invoiceCount} invoices`,
      change: null,
      className: "border-red-200 bg-red-50/50",
      valueClassName: "text-red-700"
    }
  ] as const;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Financial summary</h2>
        <p className="mt-1 text-xs text-slate-500">
          {summary.period.from} → {summary.period.to} · {summary.period.timezone}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.key} className={`rounded-xl border p-4 ${card.className}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${card.valueClassName}`}>
              {formatFinancialMoney(card.amount, currency)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{card.meta}</p>
            {formatPercentageChange(card.change) ? (
              <p className="mt-1 text-xs text-slate-500">vs prior {formatPercentageChange(card.change)}</p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
