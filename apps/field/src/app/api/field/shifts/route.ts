import { NextResponse } from "next/server";

import { callFieldShifts } from "@/lib/field-shifts-client";
import { fieldLocationNotReadyMessage } from "@/lib/field-messages";
import { requireFieldSession } from "@/lib/field-route-auth";
import { resolveFieldRuntime } from "@/lib/field-runtime";

export async function GET(request: Request) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  const runtime = await resolveFieldRuntime(request);

  if (!runtime.clockAvailable || !runtime.companyId || !runtime.locationId) {
    return NextResponse.json({ message: fieldLocationNotReadyMessage() }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  const result = await callFieldShifts({
    companyId: runtime.companyId,
    locationId: runtime.locationId,
    employeeId: auth.session.employeeId,
    from,
    to
  });

  if (!result.ok) {
    return NextResponse.json(
      { message: result.payload.message ?? "Unable to load shifts." },
      { status: result.status }
    );
  }

  return NextResponse.json(result.payload);
}
