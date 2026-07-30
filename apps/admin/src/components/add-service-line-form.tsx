"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ADD_SERVICE_TO_WORK_ORDER_COPY } from "../lib/operations-module-copy";
import { filterActiveCatalogItems, formatWorkOrderMoney } from "../lib/work-order-utils";
import type { ServiceCatalogListRecord } from "../lib/service-catalog-utils";

type AddServiceLineFormProps = {
  readonly workOrderId: string;
  readonly catalogItems: ServiceCatalogListRecord[];
  readonly existingServiceNames?: string[];
  readonly onAdded?: () => void;
};

export function AddServiceLineForm({
  workOrderId,
  catalogItems,
  existingServiceNames = [],
  onAdded
}: AddServiceLineFormProps) {
  const router = useRouter();
  const activeItems = useMemo(() => filterActiveCatalogItems(catalogItems), [catalogItems]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const availableItems = useMemo(
    () => activeItems.filter((item) => !existingServiceNames.includes(item.name)),
    [activeItems, existingServiceNames]
  );

  function toggleItem(itemId: string) {
    setSelectedIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
    );
  }

  async function handleSubmit() {
    if (selectedIds.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/company-operations/work-orders/${workOrderId}/service-lines`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ serviceCatalogItemIds: selectedIds })
        }
      );

      const payload = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        setError(payload.message ?? "Unable to add services.");
        return;
      }

      setSelectedIds([]);
      setIsOpen(false);
      onAdded?.();
      router.refresh();
    } catch {
      setError("Unable to add services. Check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg border border-dashed border-brand-300 bg-brand-50/40 px-3 py-1.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-50"
      >
        + Add service
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white p-4 sm:max-w-md">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-slate-900">Add services</h4>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setSelectedIds([]);
            setError(null);
          }}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
      </div>

      <p className="mt-2 text-xs text-slate-500">{ADD_SERVICE_TO_WORK_ORDER_COPY}</p>

      {availableItems.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">All active catalog services are already on this work order.</p>
      ) : (
        <>
          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
            {availableItems.map((item) => {
              const checked = selectedIds.includes(item.id);
              return (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm transition ${
                    checked
                      ? "border-brand-300 bg-brand-50/40"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleItem(item.id)}
                    disabled={isSubmitting}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-slate-900">{item.name}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {formatWorkOrderMoney(item.fixedPriceMinor, item.currencyCode)}
                      {item.category ? ` · ${item.category}` : ""}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {error && (
            <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || selectedIds.length === 0}
            className="mt-3 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting
              ? "Adding…"
              : `Add ${selectedIds.length || ""} service${selectedIds.length !== 1 ? "s" : ""}`}
          </button>
        </>
      )}
    </div>
  );
}
