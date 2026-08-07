/** Server-only Field clock client — uses location-scoped API, no kiosk secrets in env. */

import { fieldLocationNotReadyMessage } from "@/lib/field-messages";
import type { KioskSessionPayload } from "@/lib/field-kiosk-client";
import { isFieldClockConfigured, callKioskLookup, callKioskPunch } from "@/lib/field-kiosk-client";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";
const FIELD_SERVICE_SECRET = process.env.FIELD_SERVICE_SECRET?.trim() ?? "";

type FieldClockContext = {
  companyId: string;
  locationId: string;
};

function serviceHeaders(): Record<string, string> | null {
  if (!FIELD_SERVICE_SECRET) {
    return null;
  }

  return {
    "content-type": "application/json",
    "x-field-service-secret": FIELD_SERVICE_SECRET
  };
}

export function isFieldClockAvailable(context: {
  clockAvailable?: boolean;
  companyId?: string | null;
  locationId?: string | null;
}): boolean {
  if (context.clockAvailable === true && context.companyId && context.locationId) {
    return Boolean(FIELD_SERVICE_SECRET);
  }

  return isFieldClockConfigured();
}

export async function callFieldClockLookup(
  context: FieldClockContext,
  pin: string
): Promise<{ ok: boolean; status: number; payload: KioskSessionPayload }> {
  const headers = serviceHeaders();
  if (!headers || !context.companyId || !context.locationId) {
    if (isFieldClockConfigured()) {
      return callKioskLookup(pin);
    }

    return {
      ok: false,
      status: 503,
      payload: { message: fieldLocationNotReadyMessage() }
    };
  }

  const apiResponse = await fetch(`${API_BASE_URL}/field/clock/lookup`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      companyId: context.companyId,
      locationId: context.locationId,
      pin
    }),
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as KioskSessionPayload;
  return { ok: apiResponse.ok, status: apiResponse.status, payload };
}

export async function callFieldClockPunch(
  context: FieldClockContext,
  input: {
    pin: string;
    action: string;
    idempotencyKey: string;
  }
): Promise<{ ok: boolean; status: number; payload: KioskSessionPayload }> {
  const headers = serviceHeaders();
  if (!headers || !context.companyId || !context.locationId) {
    if (isFieldClockConfigured()) {
      return callKioskPunch(input);
    }

    return {
      ok: false,
      status: 503,
      payload: { message: fieldLocationNotReadyMessage() }
    };
  }

  const apiResponse = await fetch(`${API_BASE_URL}/field/clock/punch`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      companyId: context.companyId,
      locationId: context.locationId,
      pin: input.pin,
      action: input.action,
      idempotencyKey: input.idempotencyKey
    }),
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as KioskSessionPayload;
  return { ok: apiResponse.ok, status: apiResponse.status, payload };
}
