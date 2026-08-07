import {
  fieldCompanyNotConfiguredMessage,
  requireResolvedFieldCompanyId
} from "@/lib/field-company-resolver";
import type { FieldSessionData } from "@/lib/field-session";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

export type FieldWorkOrderStatus =
  | "DRAFT"
  | "READY"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "INVOICED"
  | "CANCELLED"
  | "PENDING_MECHANIC_APPROVAL"
  | "MECHANIC_REJECTED";

export type FieldMechanicApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type FieldMechanicPart = {
  id: string;
  workOrderId: string;
  name: string;
  quantity: number;
  notes: string | null;
  photoId: string | null;
  positionOrder: number;
  createdAt: string;
  updatedAt: string;
  photo?: FieldMechanicPhoto | null;
};

export type FieldMechanicPhoto = {
  id: string;
  filePath: string;
  mimeType: string;
  originalFilename: string;
  sizeBytes: number;
  category: string;
};

export type FieldMechanicApproval = {
  id: string;
  status: FieldMechanicApprovalStatus;
  note: string | null;
  contactMethod: string | null;
  decidedAt: string | null;
  createdAt: string;
  supervisor?: { id: string; fullName: string | null; email: string } | null;
};

export type FieldMechanicWorkOrder = {
  id: string;
  workOrderNumber: string;
  status: FieldWorkOrderStatus;
  notes: string | null;
  vehicle: {
    id: string;
    vin: string;
    year: number | null;
    make: string | null;
    model: string | null;
    plate: string | null;
    color: string | null;
  };
  mechanicParts: FieldMechanicPart[];
  mechanicApproval: FieldMechanicApproval | null;
};

export type FieldMechanicNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  referenceId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type FieldMechanicApiResult<T = unknown> = {
  ok: boolean;
  status: number;
  payload: T;
};

function workerCompanyId(session: FieldSessionData): string | null {
  return session.companyId?.trim() || requireResolvedFieldCompanyId();
}

export function fieldMechanicErrorMessage(): string {
  return fieldCompanyNotConfiguredMessage();
}

export function isFieldMechanicConfigured(session?: FieldSessionData): boolean {
  if (session?.companyId?.trim()) {
    return true;
  }
  return requireResolvedFieldCompanyId() !== null;
}

async function callWorker<T>(
  session: FieldSessionData,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: Record<string, unknown> | null
): Promise<FieldMechanicApiResult<T>> {
  const companyId = workerCompanyId(session);
  if (!companyId) {
    return {
      ok: false,
      status: 503,
      payload: { message: fieldMechanicErrorMessage() } as unknown as T
    };
  }

  let url = `${API_BASE_URL}${path}`;
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
    cache: "no-store"
  };

  if (method === "GET") {
    url = `${url}?companyId=${encodeURIComponent(companyId)}&pin=${encodeURIComponent(session.pin ?? "")}`;
  } else if (body !== undefined && body !== null) {
    init.body = JSON.stringify({ companyId, pin: session.pin, ...body });
  } else {
    init.body = JSON.stringify({ companyId, pin: session.pin });
  }

  const apiResponse = await fetch(url, init);
  const payload = (await apiResponse.json().catch(() => ({}))) as T;
  return { ok: apiResponse.ok, status: apiResponse.status, payload };
}

export async function createFieldMechanicOrder(
  session: FieldSessionData,
  workOrderId: string
): Promise<FieldMechanicApiResult<FieldMechanicWorkOrder>> {
  return callWorker(session, "POST", "/worker/mechanic-orders", { workOrderId });
}

export async function getFieldMechanicOrder(
  session: FieldSessionData,
  workOrderId: string
): Promise<FieldMechanicApiResult<FieldMechanicWorkOrder>> {
  return callWorker(session, "GET", `/worker/mechanic-orders/${workOrderId}`);
}

export async function addFieldMechanicPart(
  session: FieldSessionData,
  workOrderId: string,
  part: {
    name?: string | undefined;
    quantity?: number | undefined;
    notes?: string | null | undefined;
    photoId?: string | null | undefined;
  }
): Promise<FieldMechanicApiResult<FieldMechanicPart>> {
  return callWorker(session, "POST", `/worker/mechanic-orders/${workOrderId}/parts`, part);
}

export async function updateFieldMechanicPart(
  session: FieldSessionData,
  workOrderId: string,
  partId: string,
  update: {
    name?: string;
    quantity?: number;
    notes?: string | null;
    photoId?: string | null;
  }
): Promise<FieldMechanicApiResult<FieldMechanicPart>> {
  return callWorker(
    session,
    "PATCH",
    `/worker/mechanic-orders/${workOrderId}/parts/${partId}`,
    update
  );
}

export async function deleteFieldMechanicPart(
  session: FieldSessionData,
  workOrderId: string,
  partId: string
): Promise<FieldMechanicApiResult<{ id: string }>> {
  return callWorker(session, "DELETE", `/worker/mechanic-orders/${workOrderId}/parts/${partId}`, {});
}

export async function listFieldNotifications(
  session: FieldSessionData
): Promise<FieldMechanicApiResult<FieldMechanicNotification[]>> {
  return callWorker(session, "GET", "/worker/notifications");
}

export async function markFieldNotificationRead(
  session: FieldSessionData,
  notificationId: string
): Promise<FieldMechanicApiResult<{ id: string; readAt: string }>> {
  return callWorker(session, "POST", `/worker/notifications/${notificationId}/read`, {});
}

export type FieldMechanicAiSuggestion = {
  id: string;
  partId: string;
  vin: string;
  photoId: string | null;
  suggestedName: string;
  suggestedPartNumber: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  rawResponse: string | null;
  errorMessage: string | null;
  appliedByEmployee: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function identifyMechanicPart(
  session: FieldSessionData,
  workOrderId: string,
  partId: string,
  input: { vin: string; photoId: string }
): Promise<FieldMechanicApiResult<FieldMechanicAiSuggestion>> {
  return callWorker(
    session,
    "POST",
    `/worker/mechanic-orders/${workOrderId}/parts/${partId}/ai-identify`,
    input
  );
}

export async function applyMechanicAiSuggestion(
  session: FieldSessionData,
  workOrderId: string,
  partId: string
): Promise<FieldMechanicApiResult<FieldMechanicPart>> {
  return callWorker(
    session,
    "POST",
    `/worker/mechanic-orders/${workOrderId}/parts/${partId}/ai-apply`,
    {}
  );
}
