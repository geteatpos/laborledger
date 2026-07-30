import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    workOrderId: string;
  }>;
};

type AddServiceLinesBody = {
  serviceCatalogItemIds?: string[];
};

export async function POST(request: Request, context: RouteContext) {
  const { workOrderId } = await context.params;
  const body = (await request.json().catch(() => null)) as AddServiceLinesBody | null;

  if (!body?.serviceCatalogItemIds || body.serviceCatalogItemIds.length === 0) {
    return NextResponse.json(
      { message: "At least one service catalog item is required." },
      { status: 400 }
    );
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/work-orders/${workOrderId}/service-lines`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader
      },
      body: JSON.stringify({
        serviceCatalogItemIds: body.serviceCatalogItemIds
      }),
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
    id?: string;
    workOrderNumber?: string;
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to add service lines.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(
    {
      workOrder: {
        id: payload.id ?? workOrderId,
        workOrderNumber: payload.workOrderNumber
      }
    },
    { status: 201 }
  );
}
