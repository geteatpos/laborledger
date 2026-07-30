import { NextResponse } from "next/server";

import {
  API_BASE_URL,
  formatApiMessage,
  requireSessionCookie,
  unauthorizedResponse
} from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{ serviceClientId: string }>;
};

type LinkBody = {
  locationId?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { serviceClientId } = await context.params;
  const body = (await request.json().catch(() => null)) as LinkBody | null;
  const locationId = body?.locationId?.trim() ?? "";

  if (!locationId) {
    return NextResponse.json({ message: "locationId is required." }, { status: 400 });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/service-clients/${encodeURIComponent(serviceClientId)}/locations`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader
      },
      body: JSON.stringify({ locationId }),
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as { message?: string | string[] };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to share location with this client.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}
