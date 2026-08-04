import {
  fieldCompanyNotConfiguredMessage,
  requireResolvedFieldCompanyId
} from "@/lib/field-company-resolver";
import type { FieldSessionData } from "@/lib/field-session";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

export type ChecklistItemMeasurementUnit = "mm" | null;

export type FieldChecklistItemStatus = "OK" | "NEEDS_ATTENTION" | "NA";

export type FieldChecklistItemCategory =
  | "BODY"
  | "LIGHTS"
  | "GLASS"
  | "TIRES"
  | "BRAKES"
  | "FLUIDS"
  | "FILTERS"
  | "ELECTRICAL";

export type FieldChecklistItem = {
  id: string;
  key: string;
  label: string;
  category: FieldChecklistItemCategory;
  positionOrder: number;
  status: FieldChecklistItemStatus;
  notes: string | null;
  measurementValue: number | null;
  measurementUnit: ChecklistItemMeasurementUnit;
  updatedAt: string;
};

export type FieldChecklist = {
  id: string;
  workOrderId: string;
  vehicleId: string;
  employeeId: string;
  status: "IN_PROGRESS" | "COMPLETED" | "VOIDED";
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: FieldChecklistItem[];
};

export type FieldChecklistApiResult<T = FieldChecklist> = {
  ok: boolean;
  status: number;
  payload: T;
};

function workerCompanyId(session: FieldSessionData): string | null {
  return session.companyId?.trim() || requireResolvedFieldCompanyId();
}

export function fieldChecklistErrorMessage(): string {
  return fieldCompanyNotConfiguredMessage();
}

export function isFieldChecklistConfigured(session?: FieldSessionData): boolean {
  if (session?.companyId?.trim()) {
    return true;
  }
  return requireResolvedFieldCompanyId() !== null;
}

async function callWorker<T>(
  session: FieldSessionData,
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: Record<string, unknown>
): Promise<FieldChecklistApiResult<T>> {
  const companyId = workerCompanyId(session);
  if (!companyId) {
    return {
      ok: false,
      status: 503,
      payload: { message: fieldChecklistErrorMessage() } as unknown as T
    };
  }

  let url = `${API_BASE_URL}${path}`;
  const fetchOptions: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
    cache: "no-store"
  };

  if (method === "GET") {
    url = `${url}?companyId=${encodeURIComponent(companyId)}&pin=${encodeURIComponent(session.pin ?? "")}`;
  } else {
    fetchOptions.body = body
      ? JSON.stringify({ companyId, pin: session.pin, ...body })
      : JSON.stringify({ companyId, pin: session.pin });
  }

  const apiResponse = await fetch(url, fetchOptions);

  const payload = (await apiResponse.json().catch(() => ({}))) as T;
  return { ok: apiResponse.ok, status: apiResponse.status, payload };
}

export async function createFieldChecklist(
  session: FieldSessionData,
  workOrderId: string
): Promise<FieldChecklistApiResult> {
  return callWorker(session, "POST", "/worker/checklist", { workOrderId });
}

export async function getFieldChecklist(
  session: FieldSessionData,
  checklistId: string
): Promise<FieldChecklistApiResult> {
  return callWorker(session, "GET", `/worker/checklist/${checklistId}`);
}

export async function updateFieldChecklistItem(
  session: FieldSessionData,
  checklistId: string,
  itemId: string,
  update: {
    status: FieldChecklistItemStatus;
    notes?: string | null;
    measurementValue?: number | null;
    measurementUnit?: string | null;
  }
): Promise<FieldChecklistApiResult> {
  return callWorker(session, "PATCH", `/worker/checklist/${checklistId}/items/${itemId}`, update);
}

export async function completeFieldChecklist(
  session: FieldSessionData,
  checklistId: string
): Promise<FieldChecklistApiResult> {
  return callWorker(session, "POST", `/worker/checklist/${checklistId}/complete`);
}
