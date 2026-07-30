import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    locationId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { locationId } = await context.params;
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/locations/${locationId}/field-site`, {
    headers: { cookie: cookieHeader },
    cache: "no-store"
  });

  const payload = await apiResponse.json().catch(() => null);
  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to load Field setup.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload);
}

type UpsertFieldSiteBody = {
  hostname?: string;
  displayName?: string;
  ready?: boolean;
};

export async function POST(request: Request, context: RouteContext) {
  const { locationId } = await context.params;
  const body = (await request.json().catch(() => null)) as UpsertFieldSiteBody | null;
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/locations/${locationId}/field-site`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify(body ?? {}),
    cache: "no-store"
  });

  const payload = await apiResponse.json().catch(() => ({}));
  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to save Field setup.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload);
}
