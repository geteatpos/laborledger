import { NextResponse } from "next/server";

import {
  createFieldChecklist,
  fieldChecklistErrorMessage,
  isFieldChecklistConfigured
} from "@/lib/field-checklist-client";
import { requireFieldSession } from "@/lib/field-route-auth";

type CreateChecklistBody = {
  workOrderId?: string;
};

export async function POST(request: Request) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldChecklistConfigured(auth.session)) {
    return NextResponse.json({ message: fieldChecklistErrorMessage() }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as CreateChecklistBody | null;
  const workOrderId = body?.workOrderId?.trim() ?? "";

  if (!workOrderId) {
    return NextResponse.json({ message: "Work order is required." }, { status: 400 });
  }

  const result = await createFieldChecklist(auth.session, workOrderId);
  return NextResponse.json(result.payload, { status: result.status });
}
