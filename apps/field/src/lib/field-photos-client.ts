import {
  fieldCompanyNotConfiguredMessage,
  requireResolvedFieldCompanyId
} from "@/lib/field-company-resolver";
import type { FieldSessionData } from "@/lib/field-session";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

export type FieldVehiclePhotoCategory =
  | "RECEPTION"
  | "EXTERIOR"
  | "INTERIOR"
  | "DAMAGE"
  | "PART";

export type FieldVehiclePhotoAngle =
  | "FRONT"
  | "REAR"
  | "DRIVER_SIDE"
  | "PASSENGER_SIDE"
  | "TOP"
  | "DETAIL"
  | "OTHER";

export type FieldVehiclePhoto = {
  id: string;
  groupId: string;
  companyId: string;
  vehicleId: string;
  workOrderId: string | null;
  uploadedByEmployeeId: string | null;
  uploadedByUserId: string | null;
  category: FieldVehiclePhotoCategory;
  angle: FieldVehiclePhotoAngle | null;
  filePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  widthPx: number | null;
  heightPx: number | null;
  capturedAt: string | null;
  uploadedAt: string;
  caption: string | null;
  deletedAt: string | null;
};

export type FieldPhotoApiResult<T> = {
  ok: boolean;
  status: number;
  payload: T;
};

export function workerCompanyId(session: FieldSessionData): string | null {
  return session.companyId?.trim() || requireResolvedFieldCompanyId();
}

export function fieldPhotosErrorMessage(): string {
  return fieldCompanyNotConfiguredMessage();
}

export function isFieldPhotosConfigured(session?: FieldSessionData): boolean {
  if (session?.companyId?.trim()) {
    return true;
  }
  return requireResolvedFieldCompanyId() !== null;
}

export async function listFieldVehiclePhotos(
  session: FieldSessionData,
  vehicleId: string,
  opts?: {
    workOrderId?: string;
    category?: FieldVehiclePhotoCategory;
  }
): Promise<FieldPhotoApiResult<FieldVehiclePhoto[] | { message: string }>> {
  const companyId = workerCompanyId(session);
  if (!companyId) {
    return {
      ok: false,
      status: 503,
      payload: { message: fieldPhotosErrorMessage() }
    };
  }

  const params = new URLSearchParams({ companyId, pin: session.pin });
  if (opts?.workOrderId) params.set("workOrderId", opts.workOrderId);
  if (opts?.category) params.set("category", opts.category);

  const apiResponse = await fetch(
    `${API_BASE_URL}/worker/vehicles/${encodeURIComponent(vehicleId)}/photos?${params.toString()}`,
    {
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as
    | FieldVehiclePhoto[]
    | { message: string };

  return { ok: apiResponse.ok, status: apiResponse.status, payload };
}

export async function uploadFieldVehiclePhoto(
  vehicleId: string,
  formData: FormData
): Promise<FieldPhotoApiResult<FieldVehiclePhoto | { message: string }>> {
  const apiResponse = await fetch(
    `${API_BASE_URL}/worker/vehicles/${encodeURIComponent(vehicleId)}/photos`,
    {
      method: "POST",
      body: formData,
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as
    | FieldVehiclePhoto
    | { message: string };

  return { ok: apiResponse.ok, status: apiResponse.status, payload };
}

export function getFieldVehiclePhotoStreamUrl(photoId: string): string {
  return `/api/field/photos/${encodeURIComponent(photoId)}/stream`;
}
