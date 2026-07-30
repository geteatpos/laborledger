import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    workOrderId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { workOrderId } = await context.params;

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/work-orders/${workOrderId}/checklist`,
    {
      headers: {
        cookie: cookieHeader
      },
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => null)) as
    | {
        message?: string | string[];
        items?: unknown;
      }
    | null;

  if (!apiResponse.ok) {
    return NextResponse.json(
      {
        message: formatApiMessage(
          payload ?? {},
          "Unable to load inspection checklist."
        )
      },
      { status: apiResponse.status }
    );
  }

  // Nest returns an empty body for `null`; never forward a non-checklist object
  // or the admin UI will crash iterating `.items`.
  if (!payload || !Array.isArray(payload.items)) {
    return NextResponse.json({ message: "Checklist not found." }, { status: 404 });
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}
