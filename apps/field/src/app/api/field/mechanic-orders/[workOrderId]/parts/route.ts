import { NextResponse } from "next/server";

import {
  addFieldMechanicPart,
  fieldMechanicErrorMessage,
  isFieldMechanicConfigured
} from "@/lib/field-mechanic-client";
import { requireFieldSession } from "@/lib/field-route-auth";

export async function POST(
  request: Request,
  context: { params: Promise<{ workOrderId: string }> }
) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldMechanicConfigured(auth.session)) {
    return NextResponse.json({ message: fieldMechanicErrorMessage() }, { status: 503 });
  }

  let body: {
    name?: string;
    quantity?: number;
    notes?: string | null;
    photoId?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const { workOrderId } = await context.params;
  if (!workOrderId?.trim()) {
    return NextResponse.json({ message: "Work order is required." }, { status: 400 });
  }

  const result = await addFieldMechanicPart(auth.session, workOrderId, body);
  return NextResponse.json(result.payload, { status: result.status });
}
