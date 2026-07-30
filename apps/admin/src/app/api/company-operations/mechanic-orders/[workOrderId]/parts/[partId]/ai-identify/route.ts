import { NextResponse } from "next/server";

import {
  API_BASE_URL,
  formatApiMessage,
  requireSessionCookie,
  unauthorizedResponse
} from "../../../../../../../../lib/api-bff";
import { fetchAuthMe, WorkspaceApiError } from "../../../../../../../../lib/workspace-auth";

type RouteContext = {
  params: Promise<{
    workOrderId: string;
    partId: string;
  }>;
};

type AiIdentifyBody = {
  vin?: string;
  photoId?: string;
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
  const { workOrderId, partId } = await context.params;

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const companyId = await resolveCompanyId(cookieHeader);
  if (!companyId) {
    return NextResponse.json(
      { message: "No active company for this session." },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as AiIdentifyBody;

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/${encodeURIComponent(companyId)}/mechanic-orders/${encodeURIComponent(workOrderId)}/parts/${encodeURIComponent(partId)}/ai-identify`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader
      },
      body: JSON.stringify({
        vin: body.vin?.trim() || undefined,
        photoId: body.photoId?.trim() || undefined
      }),
      cache: "no-store"
    }
  );

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "AI identification failed.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(responsePayload, { status: 200 });
}