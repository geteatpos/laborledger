import { NextResponse } from "next/server";

import { fieldLocationNotReadyMessage } from "@/lib/field-messages";
import { requireFieldCompanyId } from "@/lib/field-runtime";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

type OptionsBody = {
  pin?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as OptionsBody | null;
  const companyId = await requireFieldCompanyId(request);

  if (!companyId) {
    return NextResponse.json({ message: fieldLocationNotReadyMessage() }, { status: 503 });
  }

  const apiResponse = await fetch(`${API_BASE_URL}/worker/jobs/options`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ companyId, pin: body?.pin ?? "" }),
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as {
    serviceCatalogItems?: Array<{ id: string; name: string; category: string | null }>;
    message?: string;
  };

  if (!apiResponse.ok) {
    return NextResponse.json(payload, { status: apiResponse.status });
  }

  return NextResponse.json({
    serviceCatalogItems: payload.serviceCatalogItems ?? []
  });
}
