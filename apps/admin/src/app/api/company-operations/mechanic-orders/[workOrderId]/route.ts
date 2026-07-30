import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../lib/api-bff";
import { fetchAuthMe, WorkspaceApiError } from "../../../../../lib/workspace-auth";

type RouteContext = {
  params: Promise<{
    workOrderId: string;
  }>;
};

async function resolveCompanyId(cookieHeader: string): Promise<string | null> {
  try {
    const session = await fetchAuthMe(cookieHeader);
    return session.activeCompany?.id ?? session.accessibleCompanies[0]?.id ?? null;
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const { workOrderId } = await context.params;

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const companyId = await resolveCompanyId(cookieHeader);
  if (!companyId) {
    return NextResponse.json(
      { message: "Company context required for mechanic order." },
      { status: 400 }
    );
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/${encodeURIComponent(companyId)}/mechanic-orders/${encodeURIComponent(workOrderId)}`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store"
    }
  );

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
  };

  if (!apiResponse.ok) {
    if (apiResponse.status === 404) {
      return NextResponse.json({ message: "Mechanic order not found." }, { status: 404 });
    }
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to load mechanic order.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(responsePayload, { status: 200 });
}
