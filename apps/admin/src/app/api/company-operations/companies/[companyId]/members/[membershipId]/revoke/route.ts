import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{ companyId: string; membershipId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { companyId, membershipId } = await context.params;
  const cookieHeader = await requireSessionCookie();

  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/companies/${encodeURIComponent(companyId)}/members/${encodeURIComponent(membershipId)}/revoke`,
    {
      method: "POST",
      headers: { cookie: cookieHeader },
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as { message?: string | string[] };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "No se pudo revocar el acceso.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}
