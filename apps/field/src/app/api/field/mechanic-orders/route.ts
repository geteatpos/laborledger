import { NextResponse } from "next/server";

import {
  createFieldMechanicOrder,
  fieldMechanicErrorMessage,
  isFieldMechanicConfigured
} from "@/lib/field-mechanic-client";
import { requireFieldSession } from "@/lib/field-route-auth";

export async function POST(request: Request) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldMechanicConfigured(auth.session)) {
    return NextResponse.json({ message: fieldMechanicErrorMessage() }, { status: 503 });
  }

  let body: { workOrderId?: string };
  try {
    body = (await request.json()) as { workOrderId?: string };
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const workOrderId = body.workOrderId?.trim();
  if (!workOrderId) {
    return NextResponse.json({ message: "Work order is required." }, { status: 400 });
  }

  const result = await createFieldMechanicOrder(auth.session, workOrderId);
  return NextResponse.json(result.payload, { status: result.status });
}
