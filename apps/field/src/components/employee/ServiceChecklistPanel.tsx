"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { isBrowserOffline } from "@/lib/offline";
import {
  applyMarkToAssignment,
  applyUnmarkToAssignment,
  buildServiceChecklistRows,
  collectPreassignedCatalogIds,
  countMarkedServices,
  revertFailedServiceSync,
  type FinalizeSummary,
  type ServiceCatalogItem,
  type ServiceChecklistRow
} from "@/lib/service-checklist-utils";
import type { WorkerAssignmentRecord } from "@/lib/worker-utils";

export type ServiceChecklistAuth =
  | { mode: "session" }
  | { mode: "pin"; pin: string };

type PendingSyncState = {
  catalogItemId: string;
  action: "mark" | "unmark";
};

type ServiceChecklistPanelProps = {
  readonly workOrderId: string;
  readonly assignment: WorkerAssignmentRecord;
  readonly auth: ServiceChecklistAuth;
  readonly disabled?: boolean;
  readonly employeeId?: string;
  readonly employeeName?: string;
  readonly onAssignmentChange: (assignment: WorkerAssignmentRecord) => void;
};

function canUncheckRow(row: ServiceChecklistRow): boolean {
  return row.marked && !row.preassigned;
}

export function ServiceChecklistFinalizeSummary({
  summary
}: {
  readonly summary: FinalizeSummary;
}) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-emerald-900">Job finalized</h3>
      <p className="mt-1 text-sm text-emerald-800">{summary.workOrderNumber}</p>
      <p className="mt-3 text-sm text-emerald-900">
        {summary.completedServiceCount} service
        {summary.completedServiceCount === 1 ? "" : "s"} completed
      </p>
      {summary.completedServices.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-emerald-900">
          {summary.completedServices.map((serviceName) => (
            <li key={serviceName}>• {serviceName}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-4 text-sm font-medium text-emerald-900">
        Total time: {formatDurationLabel(summary.totalDurationMs)}
      </p>
      <p className="mt-2 text-sm text-emerald-800">{summary.message}</p>
    </div>
  );
}

export function formatDurationLabel(totalDurationMs: number | null): string {
  if (totalDurationMs === null || totalDurationMs < 0) {
    return "—";
  }

  const totalMinutes = Math.round(totalDurationMs / 60_000);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
}

export function ServiceChecklistPanel({
  workOrderId,
  assignment,
  auth,
  disabled = false,
  employeeId,
  employeeName,
  onAssignmentChange
}: ServiceChecklistPanelProps) {
  const [catalogItems, setCatalogItems] = useState<ServiceCatalogItem[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [pendingSync, setPendingSync] = useState<PendingSyncState | null>(null);
  const [failedSync, setFailedSync] = useState<PendingSyncState | null>(null);
  const preassignedRef = useRef(collectPreassignedCatalogIds(assignment));
  const assignmentRef = useRef(assignment);

  useEffect(() => {
    const refCompletedIds = new Set(
      assignmentRef.current.serviceLines
        .filter((line) => line.completion)
        .map((line) => line.serviceCatalogItemId)
    );
    const propCompletedIds = new Set(
      assignment.serviceLines
        .filter((line) => line.completion)
        .map((line) => line.serviceCatalogItemId)
    );
    const refHasUnsyncedMarks = [...refCompletedIds].some((id) => !propCompletedIds.has(id));
    if (!refHasUnsyncedMarks) {
      assignmentRef.current = assignment;
    }
  }, [assignment]);

  useEffect(() => {
    preassignedRef.current = collectPreassignedCatalogIds(assignment);
  }, [assignment.assignmentId, workOrderId]);

  const rows = useMemo(
    () => buildServiceChecklistRows(catalogItems, assignment, preassignedRef.current),
    [catalogItems, assignment]
  );
  const counts = useMemo(() => countMarkedServices(rows), [rows]);

  const loadCatalog = useCallback(async () => {
    setIsLoadingCatalog(true);
    setCatalogError(null);

    try {
      if (auth.mode === "session") {
        const response = await fetch("/api/field/jobs/options", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as {
          serviceCatalogItems?: ServiceCatalogItem[];
          message?: string;
        };

        if (!response.ok) {
          setCatalogError(payload.message ?? "Unable to load service catalog.");
          setCatalogItems([]);
          setIsLoadingCatalog(false);
          return;
        }

        setCatalogItems(payload.serviceCatalogItems ?? []);
        setIsLoadingCatalog(false);
        return;
      }

      const response = await fetch("/api/worker/jobs/options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin: auth.pin }),
        cache: "no-store"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        serviceCatalogItems?: ServiceCatalogItem[];
        message?: string;
      };

      if (!response.ok) {
        setCatalogError(payload.message ?? "Unable to load service catalog.");
        setCatalogItems([]);
        setIsLoadingCatalog(false);
        return;
      }

      setCatalogItems(payload.serviceCatalogItems ?? []);
      setIsLoadingCatalog(false);
    } catch {
      setCatalogError("Network error while loading services.");
      setCatalogItems([]);
      setIsLoadingCatalog(false);
    }
  }, [auth]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  async function callMark(catalogItemId: string) {
    if (auth.mode === "session") {
      return fetch(`/api/field/jobs/${workOrderId}/services/mark`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serviceCatalogItemId: catalogItemId })
      });
    }

    return fetch(`/api/worker/work-orders/${workOrderId}/services/mark`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin: auth.pin, serviceCatalogItemId: catalogItemId })
    });
  }

  async function callUnmark(catalogItemId: string) {
    if (auth.mode === "session") {
      return fetch(`/api/field/jobs/${workOrderId}/services/unmark`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serviceCatalogItemId: catalogItemId })
      });
    }

    return fetch(`/api/worker/work-orders/${workOrderId}/services/unmark`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin: auth.pin, serviceCatalogItemId: catalogItemId })
    });
  }

  async function syncRow(action: "mark" | "unmark", catalogItemId: string, row: ServiceChecklistRow) {
    if (disabled) {
      return;
    }

    if (isBrowserOffline()) {
      setRowError("You are offline. Changes will retry when you reconnect.");
      setFailedSync({ catalogItemId, action });
      return;
    }

    setPendingSync({ catalogItemId, action });
    setFailedSync(null);
    setRowError(null);

    const baseAssignment = assignmentRef.current;
    const optimisticAssignment =
      action === "mark"
        ? applyMarkToAssignment(baseAssignment, {
            serviceCatalogItemId: catalogItemId,
            serviceName: row.name,
            workOrderServiceLineId: row.serviceLineId ?? `pending-${catalogItemId}`,
            serviceCompletionId: `pending-${catalogItemId}`,
            completedAt: new Date().toISOString(),
            employeeId: employeeId ?? "self",
            employeeName: employeeName ?? "You",
            category: row.category
          })
        : applyUnmarkToAssignment(baseAssignment, catalogItemId, preassignedRef.current);

    assignmentRef.current = optimisticAssignment;
    onAssignmentChange(optimisticAssignment);

    try {
      const response = await (action === "mark" ? callMark(catalogItemId) : callUnmark(catalogItemId));
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        workOrderServiceLineId?: string;
        serviceCompletionId?: string;
        serviceName?: string;
        completedAt?: string;
        employeeName?: string;
      };

      setPendingSync(null);

      if (!response.ok) {
        const revertedAssignment = revertFailedServiceSync(
          action,
          optimisticAssignment,
          baseAssignment,
          catalogItemId,
          preassignedRef.current
        );
        assignmentRef.current = revertedAssignment;
        onAssignmentChange(revertedAssignment);
        setFailedSync({ catalogItemId, action });
        setRowError(payload.message ?? "Unable to sync service checklist.");
        return;
      }

      if (action === "mark") {
        const confirmedAssignment = applyMarkToAssignment(optimisticAssignment, {
          serviceCatalogItemId: catalogItemId,
          serviceName: payload.serviceName ?? row.name,
          workOrderServiceLineId: payload.workOrderServiceLineId ?? row.serviceLineId ?? "",
          serviceCompletionId: payload.serviceCompletionId ?? "",
          completedAt: payload.completedAt ?? new Date().toISOString(),
          employeeId: employeeId ?? "self",
          employeeName: payload.employeeName ?? employeeName ?? "You",
          category: row.category
        });
        assignmentRef.current = confirmedAssignment;
        onAssignmentChange(confirmedAssignment);
      } else {
        assignmentRef.current = optimisticAssignment;
        onAssignmentChange(optimisticAssignment);
      }
    } catch {
      setPendingSync(null);
      const revertedAssignment = revertFailedServiceSync(
        action,
        optimisticAssignment,
        baseAssignment,
        catalogItemId,
        preassignedRef.current
      );
      assignmentRef.current = revertedAssignment;
      onAssignmentChange(revertedAssignment);
      setFailedSync({ catalogItemId, action });
      setRowError("Network error. Tap retry on the pending service.");
    }
  }

  async function handleToggle(row: ServiceChecklistRow) {
    if (disabled || pendingSync) {
      return;
    }

    if (row.marked) {
      if (!canUncheckRow(row)) {
        return;
      }
      await syncRow("unmark", row.catalogItemId, row);
      return;
    }

    await syncRow("mark", row.catalogItemId, row);
  }

  async function handleRetryFailed() {
    if (!failedSync) {
      return;
    }

    const row = rows.find((entry) => entry.catalogItemId === failedSync.catalogItemId);
    if (!row) {
      setFailedSync(null);
      return;
    }

    await syncRow(failedSync.action, failedSync.catalogItemId, row);
  }

  if (isLoadingCatalog) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Loading service checklist…
      </div>
    );
  }

  if (catalogError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <p>{catalogError}</p>
        <button
          type="button"
          onClick={() => void loadCatalog()}
          className="mt-2 font-semibold text-red-800 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-700">
          {counts.marked} of {counts.total} services marked
        </p>
        {pendingSync ? (
          <span className="text-xs font-medium text-amber-700">Pending sync…</span>
        ) : null}
      </div>

      {rowError ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {rowError}
          {failedSync ? (
            <button
              type="button"
              onClick={() => void handleRetryFailed()}
              className="ml-2 font-semibold underline"
            >
              Retry
            </button>
          ) : null}
        </p>
      ) : null}

      <ul className="space-y-2">
        {rows.map((row) => {
          const isPending = pendingSync?.catalogItemId === row.catalogItemId;
          const isFailed = failedSync?.catalogItemId === row.catalogItemId;
          const checkboxId = `service-check-${row.catalogItemId}`;
          const lockedOn = row.marked && row.preassigned;

          return (
            <li
              key={row.catalogItemId}
              className={`rounded-xl border px-4 py-3 ${
                row.marked
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <label
                htmlFor={checkboxId}
                className={`flex items-start gap-3 ${disabled || isPending ? "opacity-70" : ""}`}
              >
                <input
                  id={checkboxId}
                  type="checkbox"
                  checked={row.marked}
                  disabled={disabled || Boolean(pendingSync) || lockedOn}
                  onChange={() => void handleToggle(row)}
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-brand-600"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{row.name}</span>
                    {row.preassigned ? (
                      <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                        Assigned
                      </span>
                    ) : null}
                    {row.onlyOnWorkOrder ? (
                      <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        On job
                      </span>
                    ) : null}
                    {isPending ? (
                      <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        Pending sync
                      </span>
                    ) : null}
                    {isFailed ? (
                      <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                        Sync failed
                      </span>
                    ) : null}
                  </span>
                  {row.category ? (
                    <span className="mt-1 block text-xs text-slate-500">{row.category}</span>
                  ) : null}
                  {lockedOn ? (
                    <span className="mt-1 block text-xs text-slate-500">
                      Assigned services stay marked on this job.
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
