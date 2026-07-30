import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

type CreateClientInvoiceBody = {
  serviceClientId?: string;
  workOrderIds?: string[];
  vehicleId?: string;
  notes?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const body = (await request.json().catch(() => null)) as CreateClientInvoiceBody | null;

  if (!body?.serviceClientId) {
    return NextResponse.json({ message: "Service client is required." }, { status: 400 });
  }

  const workOrderIds = Array.isArray(body.workOrderIds)
    ? body.workOrderIds.map((id) => id.trim()).filter(Boolean)
    : [];

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/companies/${companyId}/client-invoices`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify({
      serviceClientId: body.serviceClientId,
      workOrderIds,
      ...(body.vehicleId?.trim() ? { vehicleId: body.vehicleId.trim() } : {}),
      ...(body.notes?.trim() ? { notes: body.notes.trim() } : {})
    }),
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as { message?: string | string[] };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to create draft invoice.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}
