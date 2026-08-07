import Link from "next/link";

import { StatusCard } from "@/components/shared/StatusCard";
import { fieldLocationNotReadyMessage } from "@/lib/field-messages";
import { isKioskConfigured } from "@/lib/kiosk-config";
import { isWorkerCompanyConfigured } from "@/lib/worker-config";

const ACTIONS = [
  {
    href: "/field/login",
    label: "Sign in",
    description: "Enter your PIN to start your shift.",
    primary: true
  },
  {
    href: "/field/jobs/new",
    label: "Receive Vehicle",
    description: "Scan VIN or enter manually.",
    primary: true
  },
  {
    href: "/field/work",
    label: "My Work",
    description: "View assigned jobs and services.",
    primary: true
  },
  {
    href: "/field/summary",
    label: "Summary",
    description: "Review today's work.",
    primary: false
  }
] as const;

export function EmployeeHomeHub() {
  const locationReady = isWorkerCompanyConfigured() && isKioskConfigured();

  return (
    <div className="space-y-4">
      <StatusCard
        title="LaborLedger Field"
        description="Clock in, receive vehicles, complete services, and review your day."
        tone="neutral"
      />

      {!locationReady ? (
        <StatusCard
          title="Location setup"
          description={fieldLocationNotReadyMessage()}
          tone="warning"
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={
              action.primary
                ? "rounded-2xl border border-brand-200 bg-brand-50 p-5 shadow-sm transition hover:border-brand-400"
                : "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
            }
          >
            <p className="text-base font-semibold text-slate-900">{action.label}</p>
            <p className="mt-1.5 text-sm text-slate-600">{action.description}</p>
          </Link>
        ))}
      </div>

      <Link href="/field/offline" className="text-sm font-medium text-slate-600 underline">
        Offline guidance
      </Link>
    </div>
  );
}
