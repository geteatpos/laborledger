import { NextResponse } from "next/server";

import {
  fieldMechanicErrorMessage,
  isFieldMechanicConfigured,
  markFieldNotificationRead
} from "@/lib/field-mechanic-client";
import { requireFieldSession } from "@/lib/field-route-auth";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldMechanicConfigured(auth.session)) {
    return NextResponse.json({ message: fieldMechanicErrorMessage() }, { status: 503 });
  }

  const { id } = await context.params;
  const result = await markFieldNotificationRead(auth.session, id);
  return NextResponse.json(result.payload, { status: result.status });
}
