import { NextResponse } from "next/server";

import {
  callWorkerUnmarkWorkOrderService,
  fieldJobsNotConfiguredMessage,
  isFieldJobsConfigured
} from "@/lib/field-jobs-client";
import { requireFieldSession } from "@/lib/field-route-auth";

type UnmarkBody = {
  serviceCatalogItemId?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldJobsConfigured(auth.session)) {
    return NextResponse.json({ message: fieldJobsNotConfiguredMessage() }, { status: 503 });
  }

  const { jobId } = await context.params;
  const body = (await request.json().catch(() => null)) as UnmarkBody | null;
  const serviceCatalogItemId = body?.serviceCatalogItemId?.trim() ?? "";

  if (!jobId.trim()) {
    return NextResponse.json({ message: "Job is required." }, { status: 400 });
  }

  if (!serviceCatalogItemId) {
    return NextResponse.json({ message: "Service is required." }, { status: 400 });
  }

  const result = await callWorkerUnmarkWorkOrderService(auth.session, jobId, serviceCatalogItemId);
  return NextResponse.json(result.payload, { status: result.status });
}
