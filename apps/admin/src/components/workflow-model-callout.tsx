import type { ReactNode } from "react";

type WorkflowModelCalloutProps = {
  readonly children: ReactNode;
};

export function WorkflowModelCallout({ children }: WorkflowModelCalloutProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-relaxed text-slate-600">
      {children}
    </div>
  );
}
