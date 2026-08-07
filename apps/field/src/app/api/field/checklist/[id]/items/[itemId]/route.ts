import { NextResponse } from "next/server";

import {
  fieldChecklistErrorMessage,
  isFieldChecklistConfigured,
  updateFieldChecklistItem,
  type FieldChecklistItemStatus
} from "@/lib/field-checklist-client";
import { requireFieldSession } from "@/lib/field-route-auth";

type PatchItemBody = {
  status?: FieldChecklistItemStatus;
  notes?: string;
  measurementValue?: number;
  measurementUnit?: string;
};

const ALLOWED_STATUSES: FieldChecklistItemStatus[] = ["OK", "NEEDS_ATTENTION", "NA"];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldChecklistConfigured(auth.session)) {
    return NextResponse.json({ message: fieldChecklistErrorMessage() }, { status: 503 });
  }

  const { id, itemId } = await context.params;

  if (!id || !itemId) {
    return NextResponse.json(
      { message: "Checklist and item are required." },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => null)) as PatchItemBody | null;
  const status = body?.status;

  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json(
      { message: "Item status must be OK, NEEDS_ATTENTION, or NA." },
      { status: 400 }
    );
  }

  const update: {
    status: FieldChecklistItemStatus;
    notes?: string | null;
    measurementValue?: number | null;
    measurementUnit?: string | null;
  } = { status };

  if (body?.notes != null) {
    update.notes = body.notes.trim() ? body.notes.trim() : null;
  }
  if (body?.measurementValue !== undefined) {
    update.measurementValue =
      typeof body.measurementValue === "number" ? body.measurementValue : null;
  }
  if (body?.measurementUnit != null) {
    update.measurementUnit = body.measurementUnit?.trim()
      ? body.measurementUnit.trim()
      : null;
  }

  const result = await updateFieldChecklistItem(auth.session, id, itemId, update);
  return NextResponse.json(result.payload, { status: result.status });
}
