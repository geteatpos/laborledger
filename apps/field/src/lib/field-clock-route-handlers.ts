import { NextResponse } from "next/server";

import {
  callFieldClockLookup,
  callFieldClockPunch,
  isFieldClockAvailable
} from "@/lib/field-clock-api-client";
import { mapFieldClockStatus } from "@/lib/field-clock-utils";
import { fieldLocationNotReadyMessage } from "@/lib/field-messages";
import { requireFieldSession } from "@/lib/field-route-auth";
import {
  fieldClockContextFromRuntime,
  resolveFieldRuntime
} from "@/lib/field-runtime";

export async function handleFieldClockAction(request: Request, action: string) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  const runtime = await resolveFieldRuntime(request);
  const clockContext = fieldClockContextFromRuntime(runtime);

  if (
    !isFieldClockAvailable({
      clockAvailable: runtime.clockAvailable,
      companyId: clockContext?.companyId,
      locationId: clockContext?.locationId
    })
  ) {
    return NextResponse.json({ message: fieldLocationNotReadyMessage() }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { idempotencyKey?: string } | null;
  const idempotencyKey = body?.idempotencyKey?.trim() ?? "";
  if (!idempotencyKey) {
    return NextResponse.json({ message: "idempotencyKey is required." }, { status: 400 });
  }

  if (!clockContext) {
    return NextResponse.json({ message: fieldLocationNotReadyMessage() }, { status: 503 });
  }

  const result = await callFieldClockPunch(clockContext, {
    pin: auth.session.pin,
    action,
    idempotencyKey
  });

  if (!result.ok) {
    return NextResponse.json(
      { message: result.payload.message ?? "Clock action was rejected." },
      { status: result.status }
    );
  }

  return NextResponse.json({
    duplicate: result.payload.duplicate ?? false,
    message: result.payload.duplicate
      ? "Duplicate request ignored."
      : `${action.replaceAll("_", " ")} accepted.`,
    configured: true,
    ...mapFieldClockStatus(result.payload)
  });
}

export async function handleFieldClockStatus(request: Request) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  const runtime = await resolveFieldRuntime(request);
  const clockContext = fieldClockContextFromRuntime(runtime);

  if (
    !isFieldClockAvailable({
      clockAvailable: runtime.clockAvailable,
      companyId: clockContext?.companyId,
      locationId: clockContext?.locationId
    })
  ) {
    return NextResponse.json(
      {
        configured: false,
        message: fieldLocationNotReadyMessage()
      },
      { status: 503 }
    );
  }

  if (!clockContext) {
    return NextResponse.json(
      {
        configured: false,
        message: fieldLocationNotReadyMessage()
      },
      { status: 503 }
    );
  }

  const result = await callFieldClockLookup(clockContext, auth.session.pin);

  if (!result.ok) {
    return NextResponse.json(
      { message: result.payload.message ?? "Unable to load shift status." },
      { status: result.status }
    );
  }

  return NextResponse.json({
    configured: true,
    ...mapFieldClockStatus(result.payload)
  });
}
