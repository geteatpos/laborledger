import { NextResponse } from "next/server";

import { API_BASE_URL, requireSessionCookie, unauthorizedResponse } from "../../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

function buildDraftsUrl(companyId: string, request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.toString();
  return `${API_BASE_URL}/company-operations/companies/${companyId}/labor-pay-billing/drafts${query ? `?${query}` : ""}`;
}

export async function GET(request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(buildDraftsUrl(companyId, request), {
    headers: { cookie: cookieHeader },
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: apiResponse.status });
}

export async function POST(request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const params = new URLSearchParams();

  for (const key of [
    "weekStart",
    "serviceClientId",
    "locationId",
    "employeeId",
    "onlyClosedWeeks"
  ] as const) {
    const value = body[key];
    if (typeof value === "string" && value.length > 0) {
      params.set(key, value);
    } else if (key === "onlyClosedWeeks" && value === true) {
      params.set(key, "true");
    }
  }

  const query = params.toString();
  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/companies/${companyId}/labor-pay-billing/drafts${query ? `?${query}` : ""}`,
    {
      method: "POST",
      headers: { cookie: cookieHeader },
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: apiResponse.status });
}
