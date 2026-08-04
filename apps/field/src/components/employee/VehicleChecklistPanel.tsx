"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";

import { PrimaryActionButton } from "@/components/shared/PrimaryActionButton";
import type {
  FieldChecklist,
  FieldChecklistItem,
  FieldChecklistItemStatus
} from "@/lib/field-checklist-client";

type VehicleChecklistPanelProps = {
  readonly checklistId: string;
  readonly onComplete: () => void;
};

type ItemDraft = {
  notes: string;
  measurementValue: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  BODY: "Body",
  LIGHTS: "Lights",
  GLASS: "Glass",
  TIRES: "Tires",
  BRAKES: "Brakes",
  FLUIDS: "Fluids",
  FILTERS: "Filters",
  ELECTRICAL: "Electrical"
};

const STATUS_OPTIONS: { value: FieldChecklistItemStatus; label: string; tone: string }[] = [
  { value: "OK", label: "OK", tone: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  {
    value: "NEEDS_ATTENTION",
    label: "Needs attention",
    tone: "border-amber-300 bg-amber-50 text-amber-800"
  },
  { value: "NA", label: "N/A", tone: "border-slate-300 bg-slate-50 text-slate-700" }
];

export function VehicleChecklistPanel({ checklistId, onComplete }: VehicleChecklistPanelProps) {
  const [checklist, setChecklist] = useState<FieldChecklist | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [submittingComplete, setSubmittingComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingItems, setPendingItems] = useState<string[]>([]);

  const reviewedCount = useMemo(() => {
    if (!checklist) {
      return 0;
    }
    return checklist.items.filter((item) => item.status !== "NA").length;
  }, [checklist]);

  const allReviewed = useMemo(() => {
    if (!checklist) {
      return false;
    }
    return checklist.items.every((item) => item.status !== "NA");
  }, [checklist]);

  const groupedItems = useMemo(() => {
    if (!checklist) {
      return [];
    }
    const map = new Map<string, FieldChecklistItem[]>();
    for (const item of checklist.items) {
      const key = item.category;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).map(([category, items]) => ({
      category,
      label: CATEGORY_LABELS[category] ?? category,
      items
    }));
  }, [checklist]);

  const loadChecklist = useCallback(async () => {
    try {
      const response = await fetch(`/api/field/checklist/${checklistId}`, {
        cache: "no-store"
      });
      const payload = (await response.json().catch(() => ({}))) as FieldChecklist & {
        message?: string;
      };
      if (response.status === 401) {
        setErrorMessage("Sign in required.");
        setIsLoading(false);
        console.error("[Checklist] 401 Unauthorized loading checklist:", checklistId);
        return;
      }
      if (!response.ok) {
        console.error("[Checklist] Failed to load checklist:", checklistId, "Status:", response.status, "Payload:", payload);
        setErrorMessage(payload.message ?? "Unable to load checklist.");
        setIsLoading(false);
        return;
      }
      console.log("[Checklist] Loaded successfully:", checklistId, "Items count:", payload.items?.length ?? "undefined", "First item:", payload.items?.[0] ?? "none");
      setChecklist(payload);
      setErrorMessage(null);
      setIsLoading(false);
    } catch {
      setErrorMessage("Network error while loading checklist.");
      setIsLoading(false);
    }
  }, [checklistId]);

  useEffect(() => {
    void loadChecklist();
  }, [loadChecklist]);

  async function handleItemChange(item: FieldChecklistItem, status: FieldChecklistItemStatus) {
    if (!checklist) {
      return;
    }
    const draft = drafts[item.id] ?? { notes: item.notes ?? "", measurementValue: item.measurementValue?.toString() ?? "" };
    const payload: {
      status: FieldChecklistItemStatus;
      notes?: string | null;
      measurementValue?: number | null;
      measurementUnit?: string | null;
    } = { status };
    if (status === "NEEDS_ATTENTION") {
      payload.notes = draft.notes.trim() ? draft.notes.trim() : null;
    }
    if (status !== "NA" && inventoryOf(item)) {
      const parsed = Number.parseFloat(draft.measurementValue);
      if (Number.isFinite(parsed)) {
        payload.measurementValue = parsed;
        payload.measurementUnit = item.measurementUnit ?? "mm";
      } else if (draft.measurementValue.trim().length > 0) {
        setErrorMessage(`Enter a numeric measurement for ${item.label}.`);
        return;
      }
    }

    setPendingItemId(item.id);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/field/checklist/${checklist.id}/items/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const updated = (await response.json().catch(() => ({}))) as FieldChecklist & {
        message?: string;
      };
      if (!response.ok) {
        setErrorMessage(updated.message ?? "Unable to save item.");
      } else {
        setChecklist(updated);
      }
    } catch {
      setErrorMessage("Network error while saving item.");
    } finally {
      setPendingItemId(null);
    }
  }

  function handleDraftChange(itemId: string, field: keyof ItemDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [itemId]: {
        notes: field === "notes" ? value : current[itemId]?.notes ?? "",
        measurementValue: field === "measurementValue" ? value : current[itemId]?.measurementValue ?? ""
      }
    }));
  }

  async function handleComplete() {
    if (!checklist) {
      return;
    }
    setSubmittingComplete(true);
    setErrorMessage(null);
    setPendingItems([]);

    try {
      const response = await fetch(`/api/field/checklist/${checklist.id}/complete`, {
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as FieldChecklist & {
        message?: string;
      };

      if (response.ok) {
        console.log("[Checklist] Complete successful, calling onComplete");
        setChecklist(payload);
        onComplete();
        return;
      }

      if (response.status === 422) {
        const message = payload.message ?? "Resolve all items before completing.";
        const keys = parseKeysFromMessage(message);
        setPendingItems(keys);
        setErrorMessage(message);
      } else {
        console.error("[Checklist] Failed to complete checklist:", checklist.id, "Status:", response.status, "Payload:", payload);
        setErrorMessage(payload.message ?? "Unable to complete checklist.");
      }
    } catch (error) {
      console.error("[Checklist] Network error completing checklist:", checklist.id, error);
      setErrorMessage("Network error while completing checklist.");
    } finally {
      setSubmittingComplete(false);
    }
  }

  async function handleSkip() {
    console.log("[Checklist] Skip called, calling onComplete");
    onComplete();
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        Loading inspection…
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        <p>Inspection checklist is unavailable.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <PrimaryActionButton label="Skip for now" variant="secondary" onClick={handleSkip} />
          <PrimaryActionButton label="Retry" variant="kiosk" onClick={() => void loadChecklist()} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Vehicle inspection</p>
          <p className="text-xs text-slate-500">
            {reviewedCount} of {checklist.items.length} reviewed
          </p>
        </div>
        <p className="mt-1 text-base font-semibold text-slate-900">
          Walk around the vehicle and confirm each item.
        </p>
        {errorMessage ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}
      </section>

      {groupedItems.map((group) => (
        <section
          key={group.category}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"
        >
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {group.label}
          </h3>
          {group.items.map((item) => {
            const draft = drafts[item.id] ?? {
              notes: item.notes ?? "",
              measurementValue: item.measurementValue?.toString() ?? ""
            };
            const statusStatus = item.status;
            const showNotes = statusStatus === "NEEDS_ATTENTION";
            const showMeasurement = inventoryOf(item) && statusStatus !== "NA";

            return (
              <div
                key={item.id}
                className={`rounded-xl border p-3 text-sm ${
                  pendingItems.includes(item.key)
                    ? "border-amber-300 bg-amber-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-900">{item.label}</p>
                  <ItemStatusBadge status={item.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((option) => {
                    const selected = item.status === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={pendingItemId === item.id}
                        onClick={() => void handleItemChange(item, option.value)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          selected
                            ? option.tone
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                {showMeasurement ? (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-slate-600">
                      Measurement ({item.measurementUnit ?? "mm"})
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      value={draft.measurementValue}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        handleDraftChange(item.id, "measurementValue", event.target.value)
                      }
                      onBlur={() => {
                        if (item.status !== "NA" && inventoryOf(item)) {
                          void handleItemChange(item, item.status);
                        }
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="e.g. 4.2"
                    />
                  </div>
                ) : null}

                {showNotes ? (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-slate-600">
                      Describe the issue
                    </label>
                    <textarea
                      value={draft.notes}
                      onChange={(event) => handleDraftChange(item.id, "notes", event.target.value)}
                      onBlur={() => {
                        if (item.status === "NEEDS_ATTENTION") {
                          void handleItemChange(item, "NEEDS_ATTENTION");
                        }
                      }}
                      rows={2}
                      placeholder="Cracked lens, low tread depth on inner edge…"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                ) : null}

                {pendingItemId === item.id ? (
                  <p className="mt-2 text-[11px] text-slate-500">Saving…</p>
                ) : null}
              </div>
            );
          })}
        </section>
      ))}

      <div className="sticky bottom-0 left-0 right-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-md backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {reviewedCount} of {checklist.items.length} reviewed
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <PrimaryActionButton
              label="Skip for now"
              variant="secondary"
              onClick={handleSkip}
              disabled={submittingComplete}
            />
            <PrimaryActionButton
              label={submittingComplete ? "Completing…" : "Complete inspection"}
              variant="kiosk"
              disabled={!allReviewed || submittingComplete}
              onClick={() => void handleComplete()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function inventoryOf(item: FieldChecklistItem): boolean {
  return Boolean(item.measurementUnit);
}

function parseKeysFromMessage(message: string): string[] {
  const match = message.match(/(?:items are still N\/A.*?):\s*(.+)$/i);
  if (!match) {
    return [];
  }
  return match[1].split(",").map((key) => key.trim()).filter(Boolean);
}

function ItemStatusBadge({ status }: { readonly status: FieldChecklistItemStatus }) {
  if (status === "OK") {
    return <Badge tone="border-emerald-200 bg-emerald-50 text-emerald-800">OK</Badge>;
  }
  if (status === "NEEDS_ATTENTION") {
    return <Badge tone="border-amber-200 bg-amber-50 text-amber-800">Issue</Badge>;
  }
  return <Badge tone="border-slate-200 bg-slate-50 text-slate-600">N/A</Badge>;
}

function Badge({ tone, children }: { readonly tone: string; readonly children: React.ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {children}
    </span>
  );
}
