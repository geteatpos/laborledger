import { NextResponse } from "next/server";

import {
  fieldMechanicErrorMessage,
  isFieldMechanicConfigured,
  listFieldNotifications
} from "@/lib/field-mechanic-client";
import { requireFieldSession } from "@/lib/field-route-auth";

export async function GET() {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldMechanicConfigured(auth.session)) {
    return NextResponse.json({ message: fieldMechanicErrorMessage() }, { status: 503 });
  }

  const result = await listFieldNotifications(auth.session);
  return NextResponse.json(result.payload, { status: result.status });
}
