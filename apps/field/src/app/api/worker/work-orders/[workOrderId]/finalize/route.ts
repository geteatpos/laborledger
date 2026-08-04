import { NextResponse } from "next/server";

import { fieldLocationNotReadyMessage } from "@/lib/field-messages";
import { requireFieldCompanyId } from "@/lib/field-runtime";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

type FinalizeBody = {
  pin?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ workOrderId: string }> }
) {
  const { workOrderId } = await context.params;
  const body = (await request.json().catch(() => null)) as FinalizeBody | null;
  const companyId = await requireFieldCompanyId(request);

  if (!companyId) {
    return NextResponse.json({ message: fieldLocationNotReadyMessage() }, { status: 503 });
  }

  if (!workOrderId.trim()) {
    return NextResponse.json({ message: "Work order is required." }, { status: 400 });
  }

  const apiResponse = await fetch(`${API_BASE_URL}/worker/work-orders/${workOrderId}/finalize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      companyId,
      pin: body?.pin ?? ""
    }),
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: apiResponse.status });
}
