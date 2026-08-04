import { NextResponse } from "next/server";

import {
  completeFieldChecklist,
  fieldChecklistErrorMessage,
  isFieldChecklistConfigured
} from "@/lib/field-checklist-client";
import { requireFieldSession } from "@/lib/field-route-auth";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldChecklistConfigured(auth.session)) {
    return NextResponse.json({ message: fieldChecklistErrorMessage() }, { status: 503 });
  }

  const { id } = await context.params;

  if (!id || id.trim().length === 0) {
    return NextResponse.json({ message: "Checklist is required." }, { status: 400 });
  }

  const result = await completeFieldChecklist(auth.session, id);
  return NextResponse.json(result.payload, { status: result.status });
}
