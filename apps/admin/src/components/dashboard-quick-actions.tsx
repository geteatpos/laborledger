import Link from "next/link";

import { MaterialIcon } from "./ui/material-icon";

const QUICK_ACTIONS = [
  {
    href: "/reception",
    title: "Receive vehicle",
    description: "Start reception and create a work order.",
    icon: "directions_car"
  },
  {
    href: "/service-clients",
    title: "Manage clients",
    description: "Add or edit client companies and their details.",
    icon: "business"
  },
  {
    href: "/review",
    title: "Review approvals",
    description: "Approve shifts and resolve time exceptions.",
    icon: "fact_check"
  },
  {
    href: "/employees",
    title: "Manage employees",
    description: "View team roster, PINs, and assignments.",
    icon: "groups"
  },
  {
    href: "/weekly-close",
    title: "Weekly close",
    description: "Review payroll readiness and close the week.",
    icon: "event_available"
  },
  {
    href: "/labor-billing",
    title: "Labor billing",
    description: "Preview labor billing and export payroll CSV.",
    icon: "payments"
  }
] as const;

export function DashboardQuickActions() {
  return (
    <section className="glass-panel rounded-stitch p-6">
      <h2 className="stitch-section-title text-body-md">Quick actions</h2>
      <p className="mt-1 text-body-sm text-on-surface-variant">Jump to common operational workflows.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="glass-card-interactive group flex gap-3 rounded-lg px-4 py-3"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-container-20 text-primary">
              <MaterialIcon name={action.icon} />
            </span>
            <span>
              <p className="text-body-sm font-medium text-on-surface group-hover:text-primary">{action.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{action.description}</p>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
