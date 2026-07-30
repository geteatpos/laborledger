import { NextResponse } from "next/server";

import {
  API_BASE_URL,
  formatApiMessage,
  requireSessionCookie,
  unauthorizedResponse
} from "../../../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    companyId: string;
    vehicleId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { companyId, vehicleId } = await context.params;

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const incoming = new URL(request.url);
  const params = new URLSearchParams();
  const workOrderId = incoming.searchParams.get("workOrderId");
  const category = incoming.searchParams.get("category");
  if (workOrderId) params.set("workOrderId", workOrderId);
  if (category) params.set("category", category);

  const queryString = params.toString();
  const path = `/company-operations/companies/${encodeURIComponent(companyId)}/vehicles/${encodeURIComponent(vehicleId)}/photos${
    queryString ? `?${queryString}` : ""
  }`;

  const apiResponse = await fetch(`${API_BASE_URL}${path}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to load vehicle photos.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}
