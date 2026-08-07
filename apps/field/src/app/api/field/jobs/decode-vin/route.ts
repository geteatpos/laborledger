import { NextResponse } from "next/server";

import {
  callWorkerDecodeVin,
  fieldJobsNotConfiguredMessage,
  isFieldJobsConfigured
} from "@/lib/field-jobs-client";
import { requireFieldSession } from "@/lib/field-route-auth";

export async function POST(request: Request) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldJobsConfigured(auth.session)) {
    return NextResponse.json({ message: fieldJobsNotConfiguredMessage() }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { vin?: string } | null;
  const vin = body?.vin?.trim() ?? "";
  if (!vin) {
    return NextResponse.json({ message: "VIN is required." }, { status: 400 });
  }

  const result = await callWorkerDecodeVin(auth.session, vin);
  return NextResponse.json(result.payload, { status: result.status });
}
