import type { ReactNode } from "react";

type BillingModuleIntroProps = {
  readonly children: ReactNode;
  readonly help?: string;
};

export function BillingModuleIntro({ children, help }: BillingModuleIntroProps) {
  return (
    <div className="mb-6 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/20">
      <p className="text-sm leading-relaxed text-slate-600">{children}</p>
      {help ? (
        <p className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          {help}
        </p>
      ) : null}
    </div>
  );
}
