import { NextResponse } from "next/server";

import {
  callWorkerFinalizeWorkOrder,
  fieldJobsNotConfiguredMessage,
  isFieldJobsConfigured
} from "@/lib/field-jobs-client";
import { requireFieldSession } from "@/lib/field-route-auth";

export async function POST(
  _request: Request,
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
  if (jobId.trim().length === 0) {
    return NextResponse.json({ message: "Job is required." }, { status: 400 });
  }

  const result = await callWorkerFinalizeWorkOrder(auth.session, jobId);
  return NextResponse.json(result.payload, { status: result.status });
}
