"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PrimaryActionButton } from "@/components/shared/PrimaryActionButton";
import {
  ServiceChecklistFinalizeSummary,
  ServiceChecklistPanel
} from "@/components/employee/ServiceChecklistPanel";
import type { FieldJobsContextResponse } from "@/lib/field-jobs-client";
import type { FieldLaborWorkAssignment } from "@/lib/field-labor-work-client";
import { fieldJobEmptyAssignmentsMessage } from "@/lib/field-job-utils";
import {
  buildLaborWorkStartPayload,
  buildWorkExecutionCards,
  orphanActiveLaborWork,
  workExecutionStatusClassName,
  type WorkExecutionCardModel
} from "@/lib/field-work-execution-utils";
import { fieldCompanyNotConfiguredMessage } from "@/lib/field-company-resolver-client";
import { FIELD_LABOR_TIMER_DISCLAIMER } from "@/lib/field-messages";
import { isBrowserOffline } from "@/lib/offline";
import { serviceCompletionSuccessMessage, canFinalizeWorkOrder, finalizeWorkOrderSuccessMessage } from "@/lib/worker-utils";
import { buildFinalizeSummary, type FinalizeSummary } from "@/lib/service-checklist-utils";

type ActiveLaborResponse = {
  clockedIn: boolean;
  assignment: FieldLaborWorkAssignment | null;
  message?: string;
};

function WorkExecutionCardView({
  card,
  expanded,
  isBusy,
  onToggleExpand,
  onStartWork,
  onComplete,
  onFinalize,
  onAssignmentChange
}: {
  readonly card: WorkExecutionCardModel;
  readonly expanded: boolean;
  readonly isBusy: boolean;
  readonly onToggleExpand: () => void;
  readonly onStartWork: () => void;
  readonly onComplete: () => void;
  readonly onFinalize: () => void;
  readonly onAssignmentChange: (assignment: WorkExecutionCardModel["assignment"]) => void;
}) {
  const showFinalize = canFinalizeWorkOrder(card.assignment);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{card.vehicleTitle}</h3>
          <p className="mt-1 text-sm text-slate-600">Customer: {card.customerName}</p>
          <p className="text-sm text-slate-600">Service: {card.serviceName}</p>
          <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">Work order</p>
          <p className="text-sm font-medium text-slate-800">{card.assignment.workOrderNumber}</p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${workExecutionStatusClassName(card.visualStatus)}`}
        >
          {card.statusLabel}
        </span>
      </div>

      {card.startedAtLabel ? (
        <p className="mt-3 text-sm text-slate-600">Started {card.startedAtLabel}</p>
      ) : null}

      {card.laborWork?.blockedReason ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Blocked: {card.laborWork.blockedReason}
        </p>
      ) : null}

      {card.completedAtLabel ? (
        <p className="mt-3 text-sm text-emerald-800">Completed {card.completedAtLabel}</p>
      ) : null}

      {card.startBlockedReason && card.visualStatus === "not_started" ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {card.startBlockedReason}
        </p>
      ) : null}

      {expanded && card.laborWork ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Operational timer</p>
          <p className="mt-1">Progress: {card.laborWork.progressPercent}%</p>
          <p className="mt-1 text-xs text-slate-500">{FIELD_LABOR_TIMER_DISCLAIMER}</p>
        </div>
      ) : null}

      {expanded ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-sm font-medium text-slate-900">Service checklist</p>
          <div className="mt-3">
            <ServiceChecklistPanel
              workOrderId={card.assignment.workOrderId}
              assignment={card.assignment}
              auth={{ mode: "session" }}
              disabled={isBusy}
              onAssignmentChange={onAssignmentChange}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {card.canStartWork ? (
          <PrimaryActionButton
            label="Start Work"
            variant="kiosk"
            disabled={isBusy}
            onClick={onStartWork}
          />
        ) : null}

        {card.canContinue ? (
          <PrimaryActionButton
            label="Continue"
            variant="kiosk"
            disabled={isBusy}
            onClick={onToggleExpand}
          />
        ) : null}

        {card.canComplete ? (
          <PrimaryActionButton
            label="Complete"
            disabled={isBusy}
            onClick={onComplete}
          />
        ) : null}

        {showFinalize ? (
          <PrimaryActionButton
            label="Finalize job"
            variant="kiosk"
            disabled={isBusy}
            onClick={onFinalize}
          />
        ) : null}

        {card.canView ? (
          <Link
            href={`/field/jobs/${card.assignment.assignmentId}`}
            className="flex justify-center rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base font-semibold text-slate-800"
          >
            View
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function EmployeeWorkExecutionPanel() {
  const router = useRouter();
  const [context, setContext] = useState<FieldJobsContextResponse | null>(null);
  const [activeLabor, setActiveLabor] = useState<ActiveLaborResponse | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [finalizeSummary, setFinalizeSummary] = useState<FinalizeSummary | null>(null);

  const loadWorkState = useCallback(async () => {
    if (isBrowserOffline()) {
      setErrorMessage("You are offline. Connect to load your work.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [jobsResponse, laborResponse] = await Promise.all([
        fetch("/api/field/jobs/context", { cache: "no-store" }),
        fetch("/api/field/labor-work/active", { cache: "no-store" })
      ]);

      const jobsPayload = (await jobsResponse.json().catch(() => ({}))) as FieldJobsContextResponse & {
        message?: string;
      };
      const laborPayload = (await laborResponse.json().catch(() => ({}))) as ActiveLaborResponse & {
        message?: string;
      };

      if (jobsResponse.status === 401 || laborResponse.status === 401) {
        router.replace("/field/login");
        return;
      }

      if (jobsResponse.status === 503) {
        setConfigError(jobsPayload.message ?? fieldCompanyNotConfiguredMessage());
        setContext(null);
        setActiveLabor(null);
        setIsLoading(false);
        return;
      }

      if (!jobsResponse.ok) {
        setErrorMessage(jobsPayload.message ?? "Unable to load assigned jobs.");
        setIsLoading(false);
        return;
      }

      if (!laborResponse.ok) {
        setErrorMessage(laborPayload.message ?? "Unable to load active work.");
        setIsLoading(false);
        return;
      }

      setContext(jobsPayload);
      setActiveLabor(laborPayload);
      setConfigError(null);
      setIsLoading(false);
    } catch {
      setErrorMessage("Network error while loading work.");
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadWorkState();
  }, [loadWorkState]);

  const cards = useMemo(
    () =>
      buildWorkExecutionCards(context?.assignments ?? [], {
        clockedIn: activeLabor?.clockedIn === true,
        activeLaborWork: activeLabor?.assignment ?? null
      }),
    [activeLabor?.assignment, activeLabor?.clockedIn, context?.assignments]
  );

  const unmatchedLabor = useMemo(
    () => orphanActiveLaborWork(activeLabor?.assignment ?? null, cards),
    [activeLabor?.assignment, cards]
  );

  function updateAssignmentInContext(updated: WorkExecutionCardModel["assignment"]) {
    setContext((current) =>
      current
        ? {
            ...current,
            assignments: current.assignments.map((assignment) =>
              assignment.assignmentId === updated.assignmentId ? updated : assignment
            )
          }
        : current
    );
  }

  async function handleStartWork(card: WorkExecutionCardModel) {
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const response = await fetch("/api/field/labor-work/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildLaborWorkStartPayload(card.assignment, card.serviceLine))
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    setIsBusy(false);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "Unable to start work.");
      return;
    }

    setStatusMessage(payload.message ?? "Work started.");
    setExpandedCardId(card.assignment.assignmentId);
    await loadWorkState();
  }

  async function handleComplete(card: WorkExecutionCardModel) {
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      if (card.laborWork) {
        const laborResponse = await fetch(`/api/field/labor-work/${card.laborWork.id}/complete`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({})
        });

        const laborPayload = (await laborResponse.json().catch(() => ({}))) as { message?: string };
        if (!laborResponse.ok) {
          setIsBusy(false);
          setErrorMessage(laborPayload.message ?? "Unable to finish operational work.");
          return;
        }
      }

      const serviceResponse = await fetch(
        `/api/field/jobs/${card.assignment.workOrderId}/complete`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ serviceLineId: card.serviceLine.id })
        }
      );

      const servicePayload = (await serviceResponse.json().catch(() => ({}))) as {
        message?: string;
      };
      setIsBusy(false);

      if (!serviceResponse.ok) {
        setErrorMessage(servicePayload.message ?? "Unable to complete service.");
        await loadWorkState();
        return;
      }

      setStatusMessage(servicePayload.message ?? serviceCompletionSuccessMessage());
      setExpandedCardId(null);
      await loadWorkState();
    } catch {
      setIsBusy(false);
      setErrorMessage("Network error while completing work.");
    }
  }

  async function handleFinalize(card: WorkExecutionCardModel) {
    if (!canFinalizeWorkOrder(card.assignment)) {
      setErrorMessage("Mark at least one service complete before finalizing this job.");
      return;
    }

    const confirmed = window.confirm(
      "Finalize this job? Incomplete services will stay as not performed. This cannot be undone from the field app."
    );
    if (!confirmed) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/field/jobs/${card.assignment.workOrderId}/finalize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        completedServiceCount?: number;
        totalDurationMs?: number | null;
        workOrderNumber?: string;
      };
      setIsBusy(false);

      if (!response.ok) {
        setErrorMessage(payload.message ?? "Unable to finalize job.");
        return;
      }

      setFinalizeSummary(buildFinalizeSummary(card.assignment, payload));
      setStatusMessage(payload.message ?? finalizeWorkOrderSuccessMessage());
      setExpandedCardId(null);
      await loadWorkState();
    } catch {
      setIsBusy(false);
      setErrorMessage("Network error while finalizing job.");
    }
  }

  const emptyCopy = fieldJobEmptyAssignmentsMessage();

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        Loading your work…
      </section>
    );
  }

  if (configError) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm">
        {configError}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">My Work</h2>
        <p className="mt-1 text-sm text-slate-600">{FIELD_LABOR_TIMER_DISCLAIMER}</p>

        {activeLabor?.clockedIn === false ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p>Clock in first to start work.</p>
            <Link
              href="/field/clock"
              className="mt-2 inline-flex font-semibold text-brand-700 underline"
            >
              Go to Clock In
            </Link>
          </div>
        ) : null}

        {errorMessage ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        {statusMessage ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {statusMessage}
          </p>
        ) : null}

        {finalizeSummary ? (
          <div className="mt-4">
            <ServiceChecklistFinalizeSummary summary={finalizeSummary} />
          </div>
        ) : null}
      </div>

      {unmatchedLabor ? (
        <article className="rounded-2xl border border-brand-200 bg-brand-50 p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-brand-900">Active work in progress</h3>
          <p className="mt-1 text-sm text-brand-800">{unmatchedLabor.serviceName}</p>
          <p className="mt-1 text-sm text-brand-800">Client: {unmatchedLabor.clientName}</p>
          <p className="mt-2 text-sm text-brand-800">
            Status: {unmatchedLabor.status.replaceAll("_", " ")}
          </p>
        </article>
      ) : null}

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">{emptyCopy.title}</h3>
          <p className="mt-2 text-sm text-slate-600">{emptyCopy.description}</p>
          <Link
            href="/field/jobs/new"
            className="mt-4 inline-flex rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Receive a vehicle
          </Link>
        </div>
      ) : (
        cards.map((card) => (
          <WorkExecutionCardView
            key={`${card.assignment.assignmentId}-${card.serviceLine.id}`}
            card={card}
            expanded={expandedCardId === card.assignment.assignmentId}
            isBusy={isBusy}
            onToggleExpand={() =>
              setExpandedCardId((current) =>
                current === card.assignment.assignmentId ? null : card.assignment.assignmentId
              )
            }
            onStartWork={() => void handleStartWork(card)}
            onComplete={() => void handleComplete(card)}
            onFinalize={() => void handleFinalize(card)}
            onAssignmentChange={updateAssignmentInContext}
          />
        ))
      )}

      <div className="flex justify-center">
        <Link
          href="/field/jobs/new"
          className="text-sm font-semibold text-brand-700 underline"
        >
          Receive another vehicle
        </Link>
      </div>
    </section>
  );
}
