import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../lib/api-bff";
import { resolveServiceClientWritePayload } from "../../../../../lib/service-client-utils";

type RouteContext = {
  params: Promise<{
    serviceClientId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { serviceClientId } = await context.params;
  const body = await request.json().catch(() => null);
  const resolved = resolveServiceClientWritePayload(body);

  if (!resolved.ok) {
    return NextResponse.json({ message: resolved.message }, { status: 400 });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/service-clients/${serviceClientId}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify(resolved.payload),
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
    id?: string;
    name?: string;
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to update service client.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(
    {
      serviceClient: {
        id: responsePayload.id ?? serviceClientId,
        name: responsePayload.name ?? resolved.payload.name
      }
    },
    { status: 200 }
  );
}
