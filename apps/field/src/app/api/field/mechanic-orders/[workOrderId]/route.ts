import { NextResponse } from "next/server";

import {
  fieldMechanicErrorMessage,
  getFieldMechanicOrder,
  isFieldMechanicConfigured
} from "@/lib/field-mechanic-client";
import { requireFieldSession } from "@/lib/field-route-auth";

export async function GET(
  _request: Request,
  context: { params: Promise<{ workOrderId: string }> }
) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldMechanicConfigured(auth.session)) {
    return NextResponse.json({ message: fieldMechanicErrorMessage() }, { status: 503 });
  }

  const { workOrderId } = await context.params;
  if (!workOrderId?.trim()) {
    return NextResponse.json({ message: "Work order is required." }, { status: 400 });
  }

  const result = await getFieldMechanicOrder(auth.session, workOrderId);
  return NextResponse.json(result.payload, { status: result.status });
}
