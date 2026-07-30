import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (!q.trim()) {
    return NextResponse.json({ results: [] });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/companies/${companyId}/vehicles/search?q=${encodeURIComponent(q)}`,
    {
      method: "GET",
      headers: {
        cookie: cookieHeader
      },
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
    results?: unknown[];
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to search vehicles.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json({ results: payload.results ?? [] });
}
