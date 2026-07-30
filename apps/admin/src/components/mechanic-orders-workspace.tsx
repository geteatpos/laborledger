"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type OrderRow = {
  id: string;
  workOrderNumber: string;
  status: string;
  createdAt: string;
  vehicle: {
    vin: string;
    year: number | null;
    make: string | null;
    model: string | null;
  };
  mechanicParts: Array<{ id: string }>;
  mechanicApproval: {
    decidedAt: string | null;
    supervisor: { fullName: string | null } | null;
  } | null;
};

type MechanicOrdersWorkspaceProps = {
  readonly companyId: string;
  readonly statusFilter: "PENDING" | "APPROVED" | "REJECTED" | "ALL";
  readonly orders: OrderRow[];
  readonly accessLevel: "platform" | "group_owner" | "company_admin" | "supervisor";
};

const STATUS_OPTIONS: Array<{ value: "PENDING" | "APPROVED" | "REJECTED" | "ALL"; label: string }> = [
  { value: "PENDING", label: "Pending review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" }
];

function statusBadgeTone(status: string): { label: string; tone: string } {
  if (status === "PENDING_MECHANIC_APPROVAL") {
    return { label: "Pending review", tone: "bg-amber-100 text-amber-900 border border-amber-200" };
  }
  if (status === "ASSIGNED") {
    return { label: "Approved", tone: "bg-emerald-100 text-emerald-900 border border-emerald-200" };
  }
  if (status === "MECHANIC_REJECTED") {
    return { label: "Rejected", tone: "bg-red-100 text-red-900 border border-red-200" };
  }
  return { label: status, tone: "bg-slate-100 text-slate-700 border border-slate-200" };
}

function formatVehicle(vehicle: OrderRow["vehicle"]): string {
  const parts = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean);
  return parts.length ? parts.join(" ") : "Unknown vehicle";
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function MechanicOrdersWorkspace({
  statusFilter,
  orders,
  accessLevel
}: MechanicOrdersWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setFilter(next: "PENDING" | "APPROVED" | "REJECTED" | "ALL") {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "PENDING") {
      params.delete("status");
    } else {
      params.set("status", next);
    }
    router.push(`/mechanic-orders${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              statusFilter === option.value
                ? "bg-brand-600 text-white"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {option.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500">
          {orders.length} {orders.length === 1 ? "order" : "orders"}
        </span>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          No mechanic orders for this filter.
        </div>
      ) : (
        <table className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm shadow-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Work order</th>
              <th className="px-4 py-3">Parts</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const badge = statusBadgeTone(order.status);
              return (
                <tr key={order.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{formatVehicle(order.vehicle)}</p>
                    <p className="font-mono text-xs text-slate-500">{order.vehicle.vin}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">
                    {order.workOrderNumber}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{order.mechanicParts.length}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badge.tone}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{formatDate(order.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/mechanic-orders/${encodeURIComponent(order.id)}`}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        Mechanic approvals bypass the billing pipeline. Work order status flips to <code>ASSIGNED</code>{" "}
        after approval, or <code>MECHANIC_REJECTED</code> if a rejection note is recorded. Approval
        scope: <span className="font-medium">{accessLevel}</span>.
      </p>
    </div>
  );
}
