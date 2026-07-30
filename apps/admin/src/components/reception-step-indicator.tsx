import { RECEPTION_WORKFLOW_STEPS } from "../lib/operations-module-copy";
import type { ReceptionStep } from "../lib/reception-utils";

type ReceptionStepIndicatorProps = {
  readonly currentStep: ReceptionStep;
};

type DisplayStep = {
  readonly label: string;
};

function getDisplaySteps(currentStep: ReceptionStep): DisplayStep[] {
  if (currentStep === "create") {
    return [
      { label: RECEPTION_WORKFLOW_STEPS[0] },
      { label: "New vehicle" },
      { label: RECEPTION_WORKFLOW_STEPS[2] },
      { label: RECEPTION_WORKFLOW_STEPS[3] }
    ];
  }

  return RECEPTION_WORKFLOW_STEPS.map((label) => ({ label }));
}

function getActiveStepIndex(currentStep: ReceptionStep): number {
  switch (currentStep) {
    case "search":
    case "select":
      return 0;
    case "services":
      return 2;
    case "create":
      return 1;
    default:
      return 0;
  }
}

export function ReceptionStepIndicator({ currentStep }: ReceptionStepIndicatorProps) {
  const steps = getDisplaySteps(currentStep);
  const activeIndex = getActiveStepIndex(currentStep);

  return (
    <ol aria-label="Reception workflow" className="mb-6 grid gap-2 sm:grid-cols-4">
      {steps.map((step, index) => {
        const isComplete = index < activeIndex;
        const isCurrent = index === activeIndex;

        return (
          <li
            key={`${step.label}-${index}`}
            className={`rounded-lg border px-3 py-2.5 text-center transition ${
              isCurrent
                ? "border-brand-300 bg-brand-50 font-semibold text-brand-900"
                : isComplete
                  ? "border-emerald-200 bg-emerald-50/60 font-medium text-emerald-900"
                  : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            <span className="block text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
              Step {index + 1}
            </span>
            <span className="mt-0.5 block text-sm">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
