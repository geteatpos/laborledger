import { normalizeVinInput, type WorkerAssignmentRecord } from "./worker-utils";

export type FieldJobWorkflowStep =
  | "assignments"
  | "vin"
  | "customer"
  | "location"
  | "service"
  | "notes"
  | "done";

export type ReceiveVehicleStep =
  | "scan"
  | "vin"
  | "vehicle"
  | "customer"
  | "service"
  | "confirm"
  | "checklist"
  | "photos"
  | "mechanic"
  | "done";

export const RECEIVE_VEHICLE_STEP_LABELS: Record<ReceiveVehicleStep, string> = {
  scan: "Scan VIN",
  vin: "Enter VIN",
  vehicle: "Confirm vehicle",
  customer: "Confirm customer",
  service: "Select service",
  confirm: "Review",
  checklist: "Vehicle inspection",
  photos: "Reception photos",
  mechanic: "Mechanic parts",
  done: "Complete"
};

export const RECEIVE_VEHICLE_PROGRESS_STEPS: ReceiveVehicleStep[] = [
  "scan",
  "vehicle",
  "customer",
  "service",
  "confirm",
  "checklist",
  "photos",
  "mechanic"
];

export function receiveVehicleStepIndex(step: ReceiveVehicleStep): number {
  if (step === "vin") {
    return 0;
  }
  if (step === "done") {
    return RECEIVE_VEHICLE_PROGRESS_STEPS.length;
  }
  const index = RECEIVE_VEHICLE_PROGRESS_STEPS.indexOf(step);
  return index >= 0 ? index : 0;
}

export function formatDecodedVehicleTitle(input: {
  year?: number | null;
  make?: string | null;
  model?: string | null;
}) {
  const title = [input.year, input.make, input.model].filter(Boolean).join(" ");
  return title || "Vehicle";
}

export function findAssignmentByVin(
  assignments: WorkerAssignmentRecord[],
  rawVin: string
): WorkerAssignmentRecord | null {
  const normalized = normalizeVinInput(rawVin);
  if (!normalized) {
    return null;
  }

  return assignments.find((assignment) => assignment.vehicle.vin === normalized) ?? null;
}

export function findAssignmentById(
  assignments: WorkerAssignmentRecord[],
  assignmentId: string
): WorkerAssignmentRecord | null {
  return assignments.find((assignment) => assignment.assignmentId === assignmentId) ?? null;
}

export function pendingServiceLines(assignment: WorkerAssignmentRecord) {
  return assignment.serviceLines.filter((line) => !line.completion);
}

export function assignmentRequiresLocationStep(assignment: WorkerAssignmentRecord) {
  return Boolean(assignment.location?.name);
}

export function fieldJobCreationRequiredMessage() {
  return "This job is not assigned to you yet. Ask your supervisor to assign the work order before you can start.";
}

export function fieldJobEmptyAssignmentsMessage() {
  return {
    title: "No assigned jobs",
    description:
      "When a supervisor assigns you to a job, it will appear here. You can also scan a VIN to find a matching assignment."
  };
}
