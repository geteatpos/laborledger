import { NextResponse } from "next/server";

import { requireFieldSession } from "@/lib/field-route-auth";

export async function POST(
  request: Request,
  context: { params: Promise<{ workOrderId: string; partId: string }> }
) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  let body: { vin?: string; photoId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const vin = body.vin?.trim() ?? "";
  const photoId = body.photoId?.trim() ?? "";
  if (!vin) {
    return NextResponse.json({ message: "VIN is required." }, { status: 400 });
  }
  if (!photoId) {
    return NextResponse.json({ message: "Photo is required." }, { status: 400 });
  }

  const { workOrderId, partId } = await context.params;
  const apiResponse = await fetch(
    `${process.env.API_BASE_URL ?? "http://127.0.0.1:4000"}/worker/mechanic-orders/${encodeURIComponent(workOrderId)}/parts/${encodeURIComponent(partId)}/ai-identify`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyId: auth.session.companyId,
        pin: auth.session.pin,
        vin,
        photoId
      }),
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as { message?: string };
  return NextResponse.json(payload, { status: apiResponse.status });
}
