import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../../../lib/api-bff";
import { fetchAuthMe, WorkspaceApiError } from "../../../../../../../../lib/workspace-auth";

type RouteContext = {
  params: Promise<{
    workOrderId: string;
    partId: string;
  }>;
};

type ShoppingLink = {
  store: string;
  url: string;
  price: number | null;
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
  const { workOrderId, partId } = await context.params;

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const companyId = await resolveCompanyId(cookieHeader);
  if (!companyId) {
    return NextResponse.json({ links: [] });
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/${encodeURIComponent(companyId)}/mechanic-orders/${encodeURIComponent(workOrderId)}/parts/${encodeURIComponent(partId)}/shopping-links`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store"
    }
  );

  const responsePayload = (await apiResponse.json().catch(() => [])) as
    | ShoppingLink[]
    | { message?: string | string[] };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload as { message?: string | string[] }, "Unable to load shopping links.") },
      { status: apiResponse.status }
    );
  }

  const links = Array.isArray(responsePayload) ? responsePayload : [];
  return NextResponse.json({ links }, { status: 200 });
}
