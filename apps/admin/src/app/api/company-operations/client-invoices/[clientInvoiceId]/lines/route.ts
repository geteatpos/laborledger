import { NextResponse } from "next/server";

import {
  API_BASE_URL,
  formatApiMessage,
  requireSessionCookie,
  unauthorizedResponse
} from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    clientInvoiceId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { clientInvoiceId } = await context.params;
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/client-invoices/${clientInvoiceId}/lines`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader
      },
      body: JSON.stringify(body),
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as { message?: string | string[] };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to add invoice line.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}
