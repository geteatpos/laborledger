/**
 * Field bootstrap from API (hostname → company/location/features).
 * Falls back to legacy env configuration for local development.
 */

import { fieldLocationNotReadyMessage } from "@/lib/field-messages";
import { isFieldCompanyConfigured, requireResolvedFieldCompanyId } from "@/lib/field-company-resolver";
import { isFieldClockConfigured } from "@/lib/field-kiosk-client";
import { readFieldRequestHostname } from "@/lib/field-request-host";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";
const BOOTSTRAP_CACHE_TTL_MS = 60_000;

export type FieldBootstrap = {
  source: "db" | "env" | "none";
  ready: boolean;
  pinLoginReady: boolean;
  clockAvailable: boolean;
  company: { id: string; name: string } | null;
  location: { id: string; name: string; timezone?: string } | null;
  message: string | null;
};

type ApiBootstrapResponse = {
  ready?: boolean;
  company?: { id?: string; name?: string; legalName?: string | null } | null;
  location?: { id?: string; name?: string; timezone?: string } | null;
  clock?: { available?: boolean };
  features?: {
    clockEnabled?: boolean;
    vehicleIntakeEnabled?: boolean;
    laborWorkEnabled?: boolean;
  };
  message?: string | null;
};

type BootstrapCacheEntry = {
  expiresAt: number;
  value: FieldBootstrap;
};

const bootstrapCache = new Map<string, BootstrapCacheEntry>();

function envBootstrap(): FieldBootstrap | null {
  const companyId = requireResolvedFieldCompanyId();
  if (!companyId) {
    return null;
  }

  const companyDisplayName = process.env.FIELD_COMPANY_DISPLAY_NAME?.trim() ?? "";
  const locationDisplayName = process.env.FIELD_LOCATION_DISPLAY_NAME?.trim() ?? "";
  const locationId = process.env.FIELD_LOCATION_ID?.trim() ?? "";
  const clockAvailable = isFieldClockConfigured();

  return {
    source: "env",
    ready: true,
    pinLoginReady: true,
    clockAvailable,
    company: {
      id: companyId,
      name: companyDisplayName || "Your workplace"
    },
    location:
      locationId.length > 0 || locationDisplayName.length > 0
        ? {
            id: locationId,
            name: locationDisplayName || "Main location"
          }
        : null,
    message: null
  };
}

function mapApiBootstrap(payload: ApiBootstrapResponse): FieldBootstrap {
  const companyId = payload.company?.id?.trim() ?? "";
  const locationId = payload.location?.id?.trim() ?? "";

  if (!companyId || !locationId) {
    return {
      source: "none",
      ready: false,
      pinLoginReady: false,
      clockAvailable: false,
      company: null,
      location: null,
      message: payload.message ?? fieldLocationNotReadyMessage()
    };
  }

  return {
    source: "db",
    ready: payload.ready === true,
    pinLoginReady: payload.ready === true,
    clockAvailable: payload.clock?.available === true,
    company: {
      id: companyId,
      name: payload.company?.name?.trim() || "Your workplace"
    },
    location: {
      id: locationId,
      name: payload.location?.name?.trim() || "Main location",
      timezone: payload.location?.timezone
    },
    message: payload.ready ? null : (payload.message ?? fieldLocationNotReadyMessage())
  };
}

async function fetchApiBootstrap(hostname: string): Promise<FieldBootstrap | null> {
  const cacheKey = hostname.toLowerCase();
  const cached = bootstrapCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const apiResponse = await fetch(`${API_BASE_URL}/field/bootstrap`, {
      headers: {
        "x-field-host": hostname
      },
      cache: "no-store"
    });

    const payload = (await apiResponse.json().catch(() => ({}))) as ApiBootstrapResponse;
    const mapped = mapApiBootstrap(payload);

    if (mapped.source === "db") {
      bootstrapCache.set(cacheKey, {
        expiresAt: Date.now() + BOOTSTRAP_CACHE_TTL_MS,
        value: mapped
      });
      return mapped;
    }

    return null;
  } catch {
    return null;
  }
}

export async function resolveFieldBootstrap(input?: {
  request?: Request;
  hostname?: string | null;
}): Promise<FieldBootstrap> {
  const hostname = input?.hostname?.trim() || readFieldRequestHostname(input?.request);

  if (hostname) {
    const fromApi = await fetchApiBootstrap(hostname);
    if (fromApi) {
      return fromApi;
    }
  }

  const fromEnv = envBootstrap();
  if (fromEnv) {
    return fromEnv;
  }

  if (isFieldCompanyConfigured()) {
    return envBootstrap() ?? unreachableEnvBootstrap();
  }

  return {
    source: "none",
    ready: false,
    pinLoginReady: false,
    clockAvailable: false,
    company: null,
    location: null,
    message: fieldLocationNotReadyMessage()
  };
}

function unreachableEnvBootstrap(): FieldBootstrap {
  return {
    source: "env",
    ready: false,
    pinLoginReady: false,
    clockAvailable: false,
    company: null,
    location: null,
    message: fieldLocationNotReadyMessage()
  };
}

/** @deprecated Use resolveFieldBootstrap — kept for synchronous server components during migration. */
export function resolveFieldBootstrapLiteSync(): {
  ready: boolean;
  pinLoginReady: boolean;
  clockAvailable: boolean;
  company: { name: string } | null;
  location: { name: string } | null;
  message: string | null;
} {
  const fromEnv = envBootstrap();
  if (fromEnv) {
    return {
      ready: fromEnv.ready,
      pinLoginReady: fromEnv.pinLoginReady,
      clockAvailable: fromEnv.clockAvailable,
      company: fromEnv.company ? { name: fromEnv.company.name } : null,
      location: fromEnv.location ? { name: fromEnv.location.name } : null,
      message: fromEnv.message
    };
  }

  return {
    ready: false,
    pinLoginReady: false,
    clockAvailable: false,
    company: null,
    location: null,
    message: fieldLocationNotReadyMessage()
  };
}
