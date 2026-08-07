import { NextResponse } from "next/server";

import { requireFieldSession } from "@/lib/field-route-auth";

export async function POST(
  _request: Request,
  context: { params: Promise<{ workOrderId: string; partId: string }> }
) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  const { workOrderId, partId } = await context.params;
  const apiResponse = await fetch(
    `${process.env.API_BASE_URL ?? "http://127.0.0.1:4000"}/worker/mechanic-orders/${encodeURIComponent(workOrderId)}/parts/${encodeURIComponent(partId)}/ai-apply`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyId: auth.session.companyId,
        pin: auth.session.pin
      }),
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as { message?: string };
  return NextResponse.json(payload, { status: apiResponse.status });
}
