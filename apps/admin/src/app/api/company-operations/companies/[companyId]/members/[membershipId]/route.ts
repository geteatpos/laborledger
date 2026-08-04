import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{ companyId: string; membershipId: string }>;
};

type UpdateMemberRoleBody = {
  role?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { companyId, membershipId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as UpdateMemberRoleBody;

  if (body.role !== "COMPANY_ADMIN" && body.role !== "SUPERVISOR") {
    return NextResponse.json({ message: "Role must be COMPANY_ADMIN or SUPERVISOR." }, { status: 400 });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/companies/${encodeURIComponent(companyId)}/members/${encodeURIComponent(membershipId)}`,
    {
      method: "PATCH",
      headers: { cookie: cookieHeader, "content-type": "application/json" },
      body: JSON.stringify({ role: body.role }),
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as { message?: string | string[] };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "No se pudo cambiar el rol.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}
