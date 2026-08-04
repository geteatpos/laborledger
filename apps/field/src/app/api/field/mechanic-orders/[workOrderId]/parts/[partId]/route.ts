import { NextResponse } from "next/server";

import {
  deleteFieldMechanicPart,
  fieldMechanicErrorMessage,
  isFieldMechanicConfigured,
  updateFieldMechanicPart
} from "@/lib/field-mechanic-client";
import { requireFieldSession } from "@/lib/field-route-auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ workOrderId: string; partId: string }> }
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

  const { workOrderId, partId } = await context.params;
  const result = await updateFieldMechanicPart(auth.session, workOrderId, partId, body);
  return NextResponse.json(result.payload, { status: result.status });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ workOrderId: string; partId: string }> }
) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldMechanicConfigured(auth.session)) {
    return NextResponse.json({ message: fieldMechanicErrorMessage() }, { status: 503 });
  }

  const { workOrderId, partId } = await context.params;
  const result = await deleteFieldMechanicPart(auth.session, workOrderId, partId);
  return NextResponse.json(result.payload, { status: result.status });
}
