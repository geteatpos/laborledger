import { PAYROLL_SOURCE_OF_TRUTH_CALLOUT } from "../lib/time-module-copy";

type PayrollSourceCalloutProps = {
  readonly emphasized?: boolean;
};

export function PayrollSourceCallout({ emphasized = false }: PayrollSourceCalloutProps) {
  return (
    <div
      className={
        emphasized
          ? "rounded-lg border border-brand-200 bg-brand-50/60 px-3.5 py-3 text-sm font-medium leading-relaxed text-brand-950"
          : "rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-relaxed text-slate-600"
      }
    >
      {PAYROLL_SOURCE_OF_TRUTH_CALLOUT}
    </div>
  );
}
