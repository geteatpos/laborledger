import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";
import { fetchAuthMe, WorkspaceApiError } from "../../../../../../lib/workspace-auth";

type RouteContext = {
  params: Promise<{
    workOrderId: string;
  }>;
};

type RejectionBody = {
  note?: string;
  contactMethod?: string;
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

export async function POST(request: Request, context: RouteContext) {
  const { workOrderId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as RejectionBody;

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  if (!body?.note?.trim()) {
    return NextResponse.json({ message: "Rejection note is required." }, { status: 400 });
  }

  const companyId = await resolveCompanyId(cookieHeader);
  if (!companyId) {
    return NextResponse.json(
      { message: "Company context required to reject mechanic order." },
      { status: 400 }
    );
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/${encodeURIComponent(companyId)}/mechanic-orders/${encodeURIComponent(workOrderId)}/reject`,
    {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieHeader },
      body: JSON.stringify({
        note: body.note,
        contactMethod: body.contactMethod ?? undefined
      }),
      cache: "no-store"
    }
  );

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to reject mechanic order.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(responsePayload, { status: apiResponse.status });
}
