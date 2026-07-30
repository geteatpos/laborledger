import Link from "next/link";

import type { DashboardAlert } from "../lib/dashboard-utils";

type DashboardAlertsProps = {
  readonly alerts: DashboardAlert[];
};

const SEVERITY_STYLES = {
  info: "stitch-alert-info",
  warning: "stitch-alert-warning",
  critical: "border border-red-200 bg-red-50 text-red-700"
} as const;

const SEVERITY_BADGES = {
  info: "bg-primary-container text-primary",
  warning: "bg-amber-100 text-warning",
  critical: "bg-red-100 text-danger"
} as const;

export function DashboardAlerts({ alerts }: DashboardAlertsProps) {
  if (alerts.length === 0) {
    return (
      <section className="glass-panel rounded-stitch p-6">
        <h2 className="stitch-section-title text-body-md">Operational alerts</h2>
        <p className="mt-2 text-body-sm leading-relaxed text-on-surface-variant">
          No active alerts. Operations look clear for your current scope.
        </p>
      </section>
    );
  }

  return (
    <section className="glass-panel rounded-stitch p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="stitch-section-title text-body-md">Operational alerts</h2>
        <span className="rounded-full bg-surface-variant px-2.5 py-0.5 text-xs font-medium text-on-surface-variant">
          {alerts.length}
        </span>
      </div>

      <ul className="mt-4 space-y-3">
        {alerts.map((alert) => (
          <li key={alert.id} className={`rounded-lg px-4 py-3 ${SEVERITY_STYLES[alert.severity]}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-body-sm font-medium">{alert.title}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${SEVERITY_BADGES[alert.severity]}`}
                  >
                    {alert.severity}
                  </span>
                </div>
                <p className="text-body-sm leading-relaxed opacity-90">{alert.message}</p>
              </div>
              {alert.href ? (
                <Link href={alert.href} className="stitch-btn-secondary shrink-0 px-3 py-1.5 text-xs">
                  Review
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
