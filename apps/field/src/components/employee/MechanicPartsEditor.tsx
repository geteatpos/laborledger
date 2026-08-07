"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  FieldMechanicAiSuggestion,
  FieldMechanicPart,
  FieldMechanicWorkOrder
} from "@/lib/field-mechanic-client";

type MechanicPartsEditorProps = {
  workOrderId: string;
  vehicleId: string;
  vin: string;
  onDone: () => void;
};

type PartDraft = {
  name: string;
  quantity: number;
  notes: string;
  photoFile: File | null;
  uploadedPhotoId: string | null;
};

type AiStage =
  | { status: "idle" }
  | { status: "loading"; startedAt: number }
  | { status: "ready"; suggestion: FieldMechanicAiSuggestion }
  | { status: "error"; message: string };

type AiKey = string;

const EMPTY_DRAFT: PartDraft = {
  name: "",
  quantity: 1,
  notes: "",
  photoFile: null,
  uploadedPhotoId: null
};

const AI_LOADING_BUDGET_MS = 25_000;

function confidenceTone(confidence: "HIGH" | "MEDIUM" | "LOW"): {
  label: string;
  tone: string;
} {
  if (confidence === "HIGH") {
    return { label: "High confidence", tone: "bg-emerald-100 text-emerald-800 border border-emerald-200" };
  }
  if (confidence === "MEDIUM") {
    return { label: "Medium confidence", tone: "bg-amber-100 text-amber-900 border border-amber-200" };
  }
  return { label: "Low confidence", tone: "bg-red-100 text-red-800 border border-red-200" };
}

function renderAppliedBadge(stage: AiStage | undefined) {
  if (!stage || stage.status !== "ready") return null;
  if (!stage.suggestion.appliedByEmployee) return null;
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
      AI ✓
    </span>
  );
}

export function MechanicPartsEditor({
  workOrderId,
  vehicleId,
  vin,
  onDone
}: MechanicPartsEditorProps) {
  const [order, setOrder] = useState<FieldMechanicWorkOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [draft, setDraft] = useState<PartDraft>(EMPTY_DRAFT);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<PartDraft>(EMPTY_DRAFT);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [aiStage, setAiStage] = useState<Record<AiKey, AiStage>>({});
  const [aiTick, setAiTick] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshOrder = useCallback(async (): Promise<FieldMechanicWorkOrder | null> => {
    console.log("[MechanicParts] refreshOrder called, workOrderId:", workOrderId);
    const response = await fetch(`/api/field/mechanic-orders/${encodeURIComponent(workOrderId)}`, {
      cache: "no-store"
    });
    const payload = (await response.json().catch(() => ({}))) as
      | FieldMechanicWorkOrder
      | { message?: string };
    console.log("[MechanicParts] refreshOrder response:", response.status, payload);
    if (!response.ok || !payload || !(payload as FieldMechanicWorkOrder).id) {
      console.log("[MechanicParts] refreshOrder returning null");
      return null;
    }
    return payload as FieldMechanicWorkOrder;
  }, [workOrderId]);

  const ensureOrder = useCallback(async () => {
    console.log("[MechanicParts] ensureOrder called, workOrderId:", workOrderId);
    const existing = await refreshOrder();
    if (existing) {
      if (!existing.mechanicApproval) {
        console.log("[MechanicParts] Order exists but no mechanic approval, creating...");
        const created = await fetch("/api/field/mechanic-orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ workOrderId })
        });
        const createdPayload = (await created.json().catch(() => ({}))) as
          | FieldMechanicWorkOrder
          | { message?: string };
        console.log("[MechanicParts] Create response:", created.status, createdPayload);
        if (!created.ok) {
          console.error("[MechanicParts] Failed to create order. Status:", created.status, "Payload:", createdPayload);
          const msg = (createdPayload as { message?: string }).message ?? "Could not open mechanic order.";
          setError(msg);
          setInitializing(false);
          return;
        }
        setOrder(createdPayload as FieldMechanicWorkOrder);
        setInitializing(false);
        return;
      }
      console.log("[MechanicParts] Order exists, setting order:", existing.id);
      setOrder(existing);
      setInitializing(false);
      return;
    }

    console.log("[MechanicParts] Order does not exist, creating...");
    const created = await fetch("/api/field/mechanic-orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workOrderId })
    });
    const createdPayload = (await created.json().catch(() => ({}))) as
      | FieldMechanicWorkOrder
      | { message?: string };
    console.log("[MechanicParts] Create response:", created.status, createdPayload);
    if (!created.ok) {
      console.error("[MechanicParts] Failed to create order. Status:", created.status, "Payload:", createdPayload);
      const msg = (createdPayload as { message?: string }).message ?? "Could not open mechanic order.";
      setError(msg);
      setInitializing(false);
      return;
    }
    setOrder(createdPayload as FieldMechanicWorkOrder);
    setInitializing(false);
  }, [refreshOrder, workOrderId]);

  useEffect(() => {
    void ensureOrder();
  }, [ensureOrder]);

  useEffect(() => {
    const interval = setInterval(() => setAiTick((tick) => tick + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  async function uploadPartPhoto(file: File): Promise<string | null> {
    const formData = new FormData();
    formData.append("category", "PART");
    formData.append("photo", file);
    formData.append("workOrderId", workOrderId);

    const response = await fetch(`/api/field/vehicles/${encodeURIComponent(vehicleId)}/photos`, {
      method: "POST",
      body: formData,
      cache: "no-store"
    });
    const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok || !payload.id) {
      setError(payload.message ?? "Photo upload failed.");
      return null;
    }
    return payload.id;
  }

  async function handleAddPart() {
    if (!draft.name.trim()) {
      setError("Part name is required.");
      return;
    }
    setError(null);
    setBusy(true);

    let photoId: string | null = draft.uploadedPhotoId;
    if (draft.photoFile && !photoId) {
      photoId = await uploadPartPhoto(draft.photoFile);
      if (!photoId) {
        setBusy(false);
        return;
      }
    }

    const response = await fetch(
      `/api/field/mechanic-orders/${encodeURIComponent(workOrderId)}/parts`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          quantity: draft.quantity,
          notes: draft.notes.trim() || null,
          photoId
        })
      }
    );
    const payload = (await response.json().catch(() => ({}))) as
      | FieldMechanicPart
      | { message?: string };

    console.log("[MechanicParts] Add part response:", response.status, payload);
    if (!response.ok) {
      console.error("[MechanicParts] Failed to add part. Status:", response.status, "WorkOrderId:", workOrderId, "Payload:", payload);
      const msg = (payload as { message?: string }).message ?? "Could not save part.";
      setError(msg);
      setBusy(false);
      return;
    }

    const refreshed = await refreshOrder();
    if (refreshed) setOrder(refreshed);
    setDraft(EMPTY_DRAFT);
    setAiStage((prev) => {
      const next = { ...prev };
      delete next["draft"];
      return next;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
    setBusy(false);
  }

  function startEditPart(part: FieldMechanicPart) {
    setEditingPartId(part.id);
    setEditDraft({
      name: part.name,
      quantity: part.quantity,
      notes: part.notes ?? "",
      photoFile: null,
      uploadedPhotoId: part.photoId
    });
  }

  async function handleUpdatePart() {
    if (!editingPartId) return;
    setError(null);
    setBusy(true);

    let photoId: string | null | undefined = editDraft.uploadedPhotoId;
    if (editDraft.photoFile) {
      const newPhotoId = await uploadPartPhoto(editDraft.photoFile);
      if (!newPhotoId) {
        setBusy(false);
        return;
      }
      photoId = newPhotoId;
    }

    const response = await fetch(
      `/api/field/mechanic-orders/${encodeURIComponent(workOrderId)}/parts/${encodeURIComponent(editingPartId)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: editDraft.name.trim() || undefined,
          quantity: editDraft.quantity,
          notes: editDraft.notes.trim() || null,
          photoId
        })
      }
    );
    const payload = (await response.json().catch(() => ({}))) as
      | FieldMechanicPart
      | { message?: string };
    if (!response.ok) {
      const msg = (payload as { message?: string }).message ?? "Could not update part.";
      setError(msg);
      setBusy(false);
      return;
    }

    const refreshed = await refreshOrder();
    if (refreshed) setOrder(refreshed);
    setEditingPartId(null);
    setEditDraft(EMPTY_DRAFT);
    if (editFileInputRef.current) editFileInputRef.current.value = "";
    setBusy(false);
  }

  async function handleDeletePart() {
    if (!confirmingDeleteId) return;
    setBusy(true);
    const response = await fetch(
      `/api/field/mechanic-orders/${encodeURIComponent(workOrderId)}/parts/${encodeURIComponent(confirmingDeleteId)}`,
      {
        method: "DELETE",
        headers: { "content-type": "application/json" }
      }
    );
    const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok) {
      const msg = payload.message ?? "Could not delete part.";
      setError(msg);
      setBusy(false);
      return;
    }
    const refreshed = await refreshOrder();
    if (refreshed) setOrder(refreshed);
    setConfirmingDeleteId(null);
    setBusy(false);
  }

  function handleSubmit() {
    if (!order || order.mechanicParts.length === 0) return;
    onDone();
  }

  function handlePhotoSelected(event: React.ChangeEvent<HTMLInputElement>, target: "draft" | "edit") {
    const file = event.target.files?.[0];
    if (!file) return;
    if (target === "draft") {
      setDraft((prev) => ({ ...prev, photoFile: file, uploadedPhotoId: null }));
      setAiStage((prev) => ({ ...prev, draft: { status: "idle" } }));
    } else {
      setEditDraft((prev) => ({ ...prev, photoFile: file, uploadedPhotoId: null }));
      if (editingPartId) {
        setAiStage((prev) => ({ ...prev, [editingPartId]: { status: "idle" } }));
      }
    }
  }

  async function runIdentify(opts: {
    key: AiKey;
    partId: string;
    photoId: string;
  }) {
    setError(null);
    setAiStage((prev) => ({
      ...prev,
      [opts.key]: { status: "loading", startedAt: Date.now() }
    }));

    try {
      const response = await fetch(
        `/api/field/mechanic-orders/${encodeURIComponent(workOrderId)}/parts/${encodeURIComponent(opts.partId)}/ai-identify`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ vin, photoId: opts.photoId })
        }
      );
      const payload = (await response.json().catch(() => ({}))) as
        | FieldMechanicAiSuggestion
        | { message?: string };
      if (!response.ok || !("id" in payload)) {
        const message =
          (payload as { message?: string }).message ??
          "AI could not identify this part right now.";
        setAiStage((prev) => ({ ...prev, [opts.key]: { status: "error", message } }));
        return;
      }
      setAiStage((prev) => ({
        ...prev,
        [opts.key]: { status: "ready", suggestion: payload as FieldMechanicAiSuggestion }
      }));
    } catch {
      setAiStage((prev) => ({
        ...prev,
        [opts.key]: {
          status: "error",
          message: "Network error while contacting AI. Enter the name manually."
        }
      }));
    }
  }

  async function applyAiSuggestion(opts: { key: AiKey; partId: string; target: "draft" | "edit" }) {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(
        `/api/field/mechanic-orders/${encodeURIComponent(workOrderId)}/parts/${encodeURIComponent(opts.partId)}/ai-apply`,
        { method: "POST", headers: { "content-type": "application/json" } }
      );
      const payload = (await response.json().catch(() => ({}))) as
        | FieldMechanicPart
        | { message?: string };
      if (!response.ok) {
        const message = (payload as { message?: string }).message ?? "Could not apply suggestion.";
        setError(message);
        return;
      }

      const part = payload as FieldMechanicPart;
      if (opts.target === "draft") {
        setDraft((prev) => ({ ...prev, name: part.name }));
      } else {
        setEditDraft((prev) => ({ ...prev, name: part.name }));
      }
      setAiStage((prev) => {
        const current = prev[opts.key];
        if (current.status !== "ready") return prev;
        return {
          ...prev,
          [opts.key]: {
            status: "ready",
            suggestion: { ...current.suggestion, appliedByEmployee: true }
          }
        };
      });
      const refreshed = await refreshOrder();
      if (refreshed) setOrder(refreshed);
    } finally {
      setBusy(false);
    }
  }

  function dismissAi(key: AiKey) {
    setAiStage((prev) => ({ ...prev, [key]: { status: "idle" } }));
  }

  if (initializing) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        Loading mechanic order…
      </section>
    );
  }

  const parts = order?.mechanicParts ?? [];
  const hasParts = parts.length > 0;

  void aiTick;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Mechanic parts</h2>
        <p className="mt-1 text-sm text-slate-600">
          Document the parts that need to be replaced or repaired. The supervisor reviews and contacts the
          vehicle owner before any work begins. Add a clear photo to identify each part with AI.
        </p>

        {parts.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {parts.map((part) => {
              const editStage = aiStage[part.id] ?? { status: "idle" };
              return (
                <li key={part.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  {editingPartId === part.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600">Name</label>
                        <input
                          value={editDraft.name}
                          onChange={(event) =>
                            setEditDraft((prev) => ({ ...prev, name: event.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600">Qty</label>
                          <input
                            type="number"
                            min={1}
                            value={editDraft.quantity}
                            onChange={(event) =>
                              setEditDraft((prev) => ({
                                ...prev,
                                quantity: Math.max(1, Number(event.target.value) || 1)
                              }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600">Replace photo</label>
                          <input
                            ref={editFileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(event) => handlePhotoSelected(event, "edit")}
                            className="mt-1 w-full text-sm"
                          />
                          {editDraft.uploadedPhotoId && !editDraft.photoFile ? (
                            <p className="mt-1 text-xs text-slate-500">Existing photo kept</p>
                          ) : null}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600">Notes</label>
                        <textarea
                          rows={2}
                          value={editDraft.notes}
                          onChange={(event) =>
                            setEditDraft((prev) => ({ ...prev, notes: event.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>

                      {editDraft.uploadedPhotoId && part.id ? (
                        <AiControls
                          stage={editStage}
                          partId={part.id}
                          photoId={editDraft.uploadedPhotoId}
                          target="edit"
                          onIdentify={runIdentify}
                          onApply={applyAiSuggestion}
                          onDismiss={dismissAi}
                          busy={busy}
                        />
                      ) : null}

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPartId(null);
                            setEditDraft(EMPTY_DRAFT);
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleUpdatePart()}
                          disabled={busy}
                          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {busy ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : confirmingDeleteId === part.id ? (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-800">
                        Remove <span className="font-medium">{part.name}</span>?
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(null)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeletePart()}
                          disabled={busy}
                          className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {busy ? "Removing…" : "Remove"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="inline-flex flex-wrap items-center gap-2 text-base font-semibold text-slate-900">
                            <span>
                              {part.name}{" "}
                              <span className="text-sm font-normal text-slate-500">× {part.quantity}</span>
                            </span>
                            {renderAppliedBadge(aiStage[part.id])}
                          </p>
                          {part.notes ? (
                            <p className="mt-1 text-sm text-slate-600">{part.notes}</p>
                          ) : null}
                          {part.photo?.id ? (
                            <a
                              href={`/api/field/photos/${encodeURIComponent(part.photo.id)}/stream`}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-block"
                            >
                              <img
                                src={`/api/field/photos/${encodeURIComponent(part.photo.id)}/stream`}
                                alt="Part photo"
                                className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                              />
                            </a>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => startEditPart(part)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(part.id)}
                          className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            No parts yet. Add at least one part to submit for approval.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-emerald-900">Add part</h3>
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">Name</label>
            <input
              value={draft.name}
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="e.g. Front brake pads"
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-base"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600">Quantity</label>
              <input
                type="number"
                min={1}
                value={draft.quantity}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    quantity: Math.max(1, Number(event.target.value) || 1)
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-base"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Photo of part</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => handlePhotoSelected(event, "draft")}
                className="mt-1 w-full text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Notes</label>
            <textarea
              rows={2}
              value={draft.notes}
              onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Condition, location, anything helpful…"
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>

          {draft.uploadedPhotoId ? (
            <AiControls
              stage={aiStage["draft"] ?? { status: "idle" }}
              partId="draft"
              photoId={draft.uploadedPhotoId}
              target="draft"
              onIdentify={(opts) => runIdentify(opts)}
              onApply={({ key }) =>
                applyAiSuggestion({ key, partId: "draft", target: "draft" })
              }
              onDismiss={dismissAi}
              busy={busy}
            />
          ) : null}

          <p className="text-xs text-slate-500">
            Add a photo first, then tap <span className="font-medium">Identify with AI</span> if you want
            help naming the part.
          </p>

          <button
            type="button"
            onClick={() => void handleAddPart()}
            disabled={busy || !draft.name.trim()}
            className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-base font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add part"}
          </button>
        </div>
      </section>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!hasParts || busy}
        className="w-full rounded-xl bg-brand-600 px-4 py-3.5 text-base font-semibold text-white disabled:opacity-50"
      >
        Submit for approval
      </button>

      <button
        type="button"
        onClick={onDone}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base font-semibold text-slate-700"
      >
        Skip for now
      </button>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function AiControls({
  stage,
  partId,
  photoId,
  target,
  onIdentify,
  onApply,
  onDismiss,
  busy
}: {
  stage: AiStage;
  partId: string;
  photoId: string;
  target: "draft" | "edit";
  onIdentify: (opts: { key: string; partId: string; photoId: string }) => Promise<void>;
  onApply: (opts: { key: string; partId: string; target: "draft" | "edit" }) => Promise<void>;
  onDismiss: (key: string) => void;
  busy: boolean;
}) {
  if (stage.status === "loading") {
    const elapsed = Date.now() - stage.startedAt;
    const slow = elapsed > AI_LOADING_BUDGET_MS;
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
          Analyzing photo with AI…
        </span>
        {slow ? (
          <p className="mt-1 text-xs text-amber-700">This is taking longer than usual…</p>
        ) : null}
      </div>
    );
  }

  if (stage.status === "error") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <p>AI could not identify this part. Please enter the name manually.</p>
        {stage.message ? (
          <p className="mt-1 text-xs text-amber-700">{stage.message}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onIdentify({ key: partId, partId, photoId })}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => onDismiss(partId)}
            className="rounded-md border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (stage.status === "ready") {
    const suggestion = stage.suggestion;
    const confidence = (
      ["HIGH", "MEDIUM", "LOW"] as const
    ).includes(suggestion.confidence as "HIGH" | "MEDIUM" | "LOW")
      ? (suggestion.confidence as "HIGH" | "MEDIUM" | "LOW")
      : "LOW";
    const tone = confidenceTone(confidence);
    const hasUsableName =
      !suggestion.errorMessage && Boolean(suggestion.suggestedName.trim());
    const helperCopy =
      partId === "draft"
        ? "Names the part right away. The draft still needs to be saved."
        : suggestion.appliedByEmployee
          ? null
          : "Updates the saved part name.";

    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">AI suggestion</p>
        <p className="mt-1 text-base font-semibold text-slate-900">
          {suggestion.suggestedName || "Unnamed part"}
        </p>
        {suggestion.suggestedPartNumber ? (
          <p className="mt-0.5 text-xs text-slate-500">
            Part # <span className="font-mono">{suggestion.suggestedPartNumber}</span>
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone.tone}`}>
            {tone.label}
          </span>
          {suggestion.appliedByEmployee ? (
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              AI ✓ applied
            </span>
          ) : null}
        </div>
        {hasUsableName ? (
          <>
            <p className="mt-2 text-xs text-slate-500">{helperCopy}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void onApply({ key: partId, partId, target })}
                disabled={busy}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Applying…" : "Use this name"}
              </button>
              <button
                type="button"
                onClick={() => onDismiss(partId)}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Dismiss
              </button>
            </div>
          </>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            AI could not return a confident name. Enter the part manually.
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void onIdentify({ key: partId, partId, photoId })}
      className="rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-50"
    >
      Identify with AI
    </button>
  );
}
