"use client";

import { useEffect, useMemo, useState } from "react";

type ChecklistItemStatus = "OK" | "NEEDS_ATTENTION" | "NA";

type ChecklistItemCategory =
  | "BODY"
  | "LIGHTS"
  | "GLASS"
  | "TIRES"
  | "BRAKES"
  | "FLUIDS"
  | "FILTERS"
  | "ELECTRICAL";

export type AdminChecklistItem = {
  id: string;
  key: string;
  label: string;
  category: ChecklistItemCategory;
  positionOrder: number;
  status: ChecklistItemStatus;
  notes: string | null;
  measurementValue: number | null;
  measurementUnit: string | null;
  updatedAt: string;
};

export type AdminChecklist = {
  id: string;
  workOrderId: string;
  vehicleId: string;
  employeeId: string;
  status: "IN_PROGRESS" | "COMPLETED" | "VOIDED";
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: AdminChecklistItem[];
};

type InspectionBlockProps = {
  readonly workOrderId: string;
};

const CATEGORY_LABELS: Record<ChecklistItemCategory, string> = {
  BODY: "Body",
  LIGHTS: "Lights",
  GLASS: "Glass",
  TIRES: "Tires",
  BRAKES: "Brakes",
  FLUIDS: "Fluids",
  FILTERS: "Filters",
  ELECTRICAL: "Electrical"
};

export function VehicleInspectionBlock({ workOrderId }: InspectionBlockProps) {
  const [checklist, setChecklist] = useState<AdminChecklist | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(
          `/api/company-operations/work-orders/${workOrderId}/checklist`,
          { cache: "no-store" }
        );
        if (cancelled) {
          return;
        }
        if (response.status === 404) {
          setChecklist(null);
          setIsLoading(false);
          return;
        }
        if (response.ok) {
          const payload = (await response.json().catch(() => null)) as AdminChecklist | null;
          if (payload && Array.isArray(payload.items)) {
            setChecklist(payload);
          } else {
            setChecklist(null);
          }
        } else {
          setChecklist(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [workOrderId]);

  const groupedItems = useMemo(() => {
    if (!checklist || !Array.isArray(checklist.items)) {
      return [];
    }
    const map = new Map<ChecklistItemCategory, AdminChecklistItem[]>();
    for (const item of checklist.items) {
      if (!map.has(item.category)) {
        map.set(item.category, []);
      }
      map.get(item.category)!.push(item);
    }
    return Array.from(map.entries()).map(([category, items]) => ({
      category,
      label: CATEGORY_LABELS[category] ?? category,
      items
    }));
  }, [checklist]);

  if (isLoading) {
    return (
      <section className="space-y-3">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
          Vehicle inspection
        </h3>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-500">
          Loading inspection status…
        </div>
      </section>
    );
  }

  if (!checklist) {
    return (
      <section className="space-y-3">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
          Vehicle inspection
        </h3>
        <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
          Inspection not performed
        </div>
      </section>
    );
  }

  if (checklist.status === "IN_PROGRESS") {
    return (
      <section className="space-y-3">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
          Vehicle inspection
        </h3>
        <div className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
          Inspection in progress
        </div>
        <p className="text-xs text-slate-500">
          Started {formatDate(checklist.startedAt)}.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
          Vehicle inspection
        </h3>
        <span className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800">
          Completed {formatDate(checklist.completedAt ?? checklist.updatedAt)}
        </span>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Item</th>
                <th className="px-3 py-2 text-left font-medium">Category</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Notes</th>
                <th className="px-3 py-2 text-left font-medium">Measurement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {groupedItems.flatMap((group) =>
                group.items.map((item) => (
                  <tr
                    key={item.id}
                    className={item.status === "NEEDS_ATTENTION" ? "bg-red-50/50" : undefined}
                  >
                    <td className="px-3 py-2 font-medium text-slate-800">{item.label}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{group.label}</td>
                    <td className="px-3 py-2">
                      <ItemBadge status={item.status} />
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {item.notes ? item.notes : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {item.measurementValue !== null && item.measurementUnit
                        ? `${item.measurementValue} ${item.measurementUnit}`
                        : <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ItemBadge({ status }: { readonly status: ChecklistItemStatus }) {
  if (status === "OK") {
    return (
      <span className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
        OK
      </span>
    );
  }
  if (status === "NEEDS_ATTENTION") {
    return (
      <span className="inline-flex rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
        Needs attention
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
      N/A
    </span>
  );
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}
