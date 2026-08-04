import { readFieldSession, type FieldSessionData } from "@/lib/field-session";
import { resolveFieldBootstrap, type FieldBootstrap } from "@/lib/field-bootstrap";
import { requireResolvedFieldCompanyId } from "@/lib/field-company-resolver";

export type FieldRuntimeContext = {
  bootstrap: FieldBootstrap;
  session: FieldSessionData | null;
  companyId: string | null;
  locationId: string | null;
  pinLoginReady: boolean;
  clockAvailable: boolean;
};

export async function resolveFieldRuntime(request?: Request): Promise<FieldRuntimeContext> {
  const bootstrap = await resolveFieldBootstrap({ request });
  const session = await readFieldSession();

  const companyId =
    session?.companyId ??
    bootstrap.company?.id ??
    requireResolvedFieldCompanyId();

  const locationId = session?.locationId ?? bootstrap.location?.id ?? null;

  return {
    bootstrap,
    session,
    companyId,
    locationId,
    pinLoginReady: bootstrap.pinLoginReady,
    clockAvailable: isFieldClockRuntimeAvailable({
      bootstrap,
      companyId,
      locationId
    })
  };
}

function isFieldClockRuntimeAvailable(input: {
  bootstrap: FieldBootstrap;
  companyId: string | null;
  locationId: string | null;
}): boolean {
  if (input.bootstrap.source === "db" && input.bootstrap.clockAvailable) {
    return Boolean(input.companyId && input.locationId);
  }

  return input.bootstrap.clockAvailable;
}

export async function requireFieldCompanyId(request?: Request): Promise<string | null> {
  const runtime = await resolveFieldRuntime(request);
  return runtime.companyId;
}

export function fieldClockContextFromRuntime(runtime: FieldRuntimeContext): {
  companyId: string;
  locationId: string;
} | null {
  if (!runtime.companyId || !runtime.locationId) {
    return null;
  }

  return {
    companyId: runtime.companyId,
    locationId: runtime.locationId
  };
}
