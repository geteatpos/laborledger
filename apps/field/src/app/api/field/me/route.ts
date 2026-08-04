import { NextResponse } from "next/server";

import { resolveFieldRuntime } from "@/lib/field-runtime";
import { requireFieldSession } from "@/lib/field-route-auth";
import { toPublicFieldSession } from "@/lib/field-session";

export async function GET(request: Request) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  const runtime = await resolveFieldRuntime(request);

  return NextResponse.json({
    session: toPublicFieldSession(auth.session),
    clockConfigured: runtime.clockAvailable,
    locationId: auth.session.locationId ?? runtime.bootstrap.location?.id ?? null,
    locationName: auth.session.locationName ?? runtime.bootstrap.location?.name ?? null
  });
}
