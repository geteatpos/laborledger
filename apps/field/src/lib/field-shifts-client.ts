/** Server-only Field shifts client — uses location-scoped API, no kiosk secrets in env. */

import { fieldLocationNotReadyMessage } from "@/lib/field-messages";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";
const FIELD_SERVICE_SECRET = process.env.FIELD_SERVICE_SECRET?.trim() ?? "";

function serviceHeaders(): Record<string, string> | null {
  if (!FIELD_SERVICE_SECRET) {
    return null;
  }
  return {
    "content-type": "application/json",
    "x-field-service-secret": FIELD_SERVICE_SECRET
  };
}

export type FieldShift = {
  id: string;
  status: string;
  scheduledStartUtc: string;
  scheduledEndUtc: string;
  timezone: string;
  locationName: string;
  clockInUtc: string | null;
  clockOutUtc: string | null;
  breakCount: number;
  workedMinutes: number | null;
  punchEvents: Array<{ action: string; eventUtc: string }>;
};

export type FieldShiftsResponse = {
  shifts: FieldShift[];
};

export async function callFieldShifts(params: {
  companyId: string;
  locationId: string;
  employeeId: string;
  from?: string;
  to?: string;
}): Promise<{ ok: boolean; status: number; payload: FieldShiftsResponse & { message?: string } }> {
  const headers = serviceHeaders();
  if (!headers) {
    return { ok: false, status: 503, payload: { shifts: [], message: fieldLocationNotReadyMessage() } };
  }

  const qs = new URLSearchParams({
    employeeId: params.employeeId,
    locationId: params.locationId
  });
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);

  const apiResponse = await fetch(
    `${API_BASE_URL}/field/shifts/my?${qs.toString()}`,
    {
      method: "GET",
      headers,
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as FieldShiftsResponse & { message?: string };
  return { ok: apiResponse.ok, status: apiResponse.status, payload };
}
