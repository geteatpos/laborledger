import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{ companyId: string; supervisorUserId: string }>;
};

type BulkRemoveBody = {
  locationIds?: unknown;
};

export async function POST(request: Request, context: RouteContext) {
  const { companyId, supervisorUserId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as BulkRemoveBody;

  const locationIds = Array.isArray(body.locationIds)
    ? body.locationIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];

  if (locationIds.length === 0) {
    return NextResponse.json({ message: "Selecciona al menos una ubicación." }, { status: 400 });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/companies/${encodeURIComponent(companyId)}/supervisors/${encodeURIComponent(supervisorUserId)}/locations/bulk-remove`,
    {
      method: "POST",
      headers: { cookie: cookieHeader, "content-type": "application/json" },
      body: JSON.stringify({ locationIds }),
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as { message?: string | string[] };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "No se pudieron quitar las ubicaciones seleccionadas.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}
