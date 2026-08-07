import type { FieldLaborWorkAssignment } from "./field-labor-work-client";
import { pendingServiceLines } from "./field-job-utils";
import {
  formatServiceLineCompletionDate,
  formatVehicleTitle,
  type WorkerAssignmentRecord
} from "./worker-utils";

export type WorkExecutionVisualStatus = "not_started" | "in_progress" | "blocked" | "complete";

export type WorkExecutionCardModel = {
  assignment: WorkerAssignmentRecord;
  serviceLine: WorkerAssignmentRecord["serviceLines"][number];
  vehicleTitle: string;
  customerName: string;
  serviceName: string;
  visualStatus: WorkExecutionVisualStatus;
  statusLabel: string;
  laborWork: FieldLaborWorkAssignment | null;
  startedAtLabel: string | null;
  completedAtLabel: string | null;
  canStartWork: boolean;
  canContinue: boolean;
  canComplete: boolean;
  canView: boolean;
  startBlockedReason: string | null;
};

export function resolvePrimaryServiceLine(assignment: WorkerAssignmentRecord) {
  if (assignment.workOrderServiceLineId) {
    return (
      assignment.serviceLines.find((line) => line.id === assignment.workOrderServiceLineId) ??
      pendingServiceLines(assignment)[0] ??
      assignment.serviceLines[0] ??
      null
    );
  }

  return pendingServiceLines(assignment)[0] ?? assignment.serviceLines[0] ?? null;
}

export function laborWorkMatchesAssignment(
  laborWork: FieldLaborWorkAssignment | null | undefined,
  assignment: WorkerAssignmentRecord,
  serviceLine: WorkerAssignmentRecord["serviceLines"][number]
) {
  if (!laborWork) {
    return false;
  }

  if (laborWork.status === "COMPLETED" || laborWork.status === "CANCELLED") {
    return false;
  }

  if (laborWork.workOrderServiceLineId && serviceLine.id) {
    return laborWork.workOrderServiceLineId === serviceLine.id;
  }

  if (laborWork.workOrderId && assignment.workOrderId) {
    return (
      laborWork.workOrderId === assignment.workOrderId &&
      laborWork.serviceCatalogItemId === serviceLine.serviceCatalogItemId
    );
  }

  return (
    laborWork.serviceCatalogItemId === serviceLine.serviceCatalogItemId &&
    laborWork.locationId === assignment.location.id &&
    laborWork.serviceClientId === assignment.serviceClient.id &&
    (laborWork.vinSnapshot ?? "") === assignment.vehicle.vin
  );
}

export function deriveWorkExecutionVisualStatus(input: {
  serviceLine: WorkerAssignmentRecord["serviceLines"][number];
  laborWork: FieldLaborWorkAssignment | null;
}): WorkExecutionVisualStatus {
  if (input.serviceLine.completion) {
    return "complete";
  }

  if (input.laborWork?.status === "BLOCKED") {
    return "blocked";
  }

  if (input.laborWork?.status === "IN_PROGRESS") {
    return "in_progress";
  }

  return "not_started";
}

export function workExecutionStatusLabel(status: WorkExecutionVisualStatus) {
  switch (status) {
    case "not_started":
      return "Not started";
    case "in_progress":
      return "In progress";
    case "blocked":
      return "Blocked";
    case "complete":
      return "Complete";
  }
}

export function workExecutionStatusClassName(status: WorkExecutionVisualStatus) {
  switch (status) {
    case "not_started":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "in_progress":
      return "border-brand-200 bg-brand-50 text-brand-900";
    case "blocked":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "complete":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }
}

export function buildLaborWorkStartPayload(
  assignment: WorkerAssignmentRecord,
  serviceLine: WorkerAssignmentRecord["serviceLines"][number]
) {
  return {
    serviceClientId: assignment.serviceClient.id,
    locationId: assignment.location.id,
    serviceCatalogItemId: serviceLine.serviceCatalogItemId,
    vehicleId: assignment.vehicle.id,
    vin: assignment.vehicle.vin,
    workOrderId: assignment.workOrderId,
    workOrderServiceLineId: serviceLine.id
  };
}

export function buildWorkExecutionCard(
  assignment: WorkerAssignmentRecord,
  input: {
    clockedIn: boolean;
    activeLaborWork: FieldLaborWorkAssignment | null;
    otherActiveLaborWork: FieldLaborWorkAssignment | null;
  }
): WorkExecutionCardModel | null {
  const serviceLine = resolvePrimaryServiceLine(assignment);
  if (!serviceLine) {
    return null;
  }

  const laborWork = laborWorkMatchesAssignment(input.activeLaborWork, assignment, serviceLine)
    ? input.activeLaborWork
    : null;

  const visualStatus = deriveWorkExecutionVisualStatus({ serviceLine, laborWork });
  const serviceComplete = Boolean(serviceLine.completion);

  let startBlockedReason: string | null = null;
  if (!input.clockedIn) {
    startBlockedReason = "Clock in first to start work.";
  } else if (input.otherActiveLaborWork) {
    startBlockedReason = "Finish your current work before starting another job.";
  } else if (!assignment.lastConfirmation?.acceptedAt) {
    startBlockedReason = "Confirm the vehicle VIN before starting work.";
  }

  const canStartWork =
    visualStatus === "not_started" && startBlockedReason === null && !serviceComplete;
  const canContinue =
    visualStatus === "in_progress" || visualStatus === "blocked" || Boolean(laborWork);
  const canComplete =
    !serviceComplete &&
    Boolean(assignment.lastConfirmation?.acceptedAt) &&
    (visualStatus === "in_progress" || visualStatus === "blocked");

  return {
    assignment,
    serviceLine,
    vehicleTitle: formatVehicleTitle(assignment.vehicle),
    customerName: assignment.serviceClient.name,
    serviceName: serviceLine.serviceNameSnapshot,
    visualStatus,
    statusLabel: workExecutionStatusLabel(visualStatus),
    laborWork,
    startedAtLabel: laborWork ? formatStartedTime(laborWork.startedAt) : null,
    completedAtLabel: serviceLine.completion
      ? formatServiceLineCompletionDate(serviceLine.completion.completedAt)
      : null,
    canStartWork,
    canContinue: canContinue && !serviceComplete,
    canComplete,
    canView: serviceComplete,
    startBlockedReason
  };
}

export function buildWorkExecutionCards(
  assignments: WorkerAssignmentRecord[],
  input: {
    clockedIn: boolean;
    activeLaborWork: FieldLaborWorkAssignment | null;
  }
) {
  const activeLaborWork = input.activeLaborWork;
  const cards = assignments
    .map((assignment) => {
      const serviceLine = resolvePrimaryServiceLine(assignment);
      if (!serviceLine) {
        return null;
      }

      const matchesActive = laborWorkMatchesAssignment(activeLaborWork, assignment, serviceLine);
      const otherActiveLaborWork =
        activeLaborWork && !matchesActive ? activeLaborWork : null;

      return buildWorkExecutionCard(assignment, {
        clockedIn: input.clockedIn,
        activeLaborWork: matchesActive ? activeLaborWork : null,
        otherActiveLaborWork
      });
    })
    .filter((card): card is WorkExecutionCardModel => card !== null);

  return cards;
}

export function formatStartedTime(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function orphanActiveLaborWork(
  activeLaborWork: FieldLaborWorkAssignment | null,
  cards: WorkExecutionCardModel[]
) {
  if (!activeLaborWork) {
    return null;
  }

  const matched = cards.some((card) => card.laborWork?.id === activeLaborWork.id);
  return matched ? null : activeLaborWork;
}
