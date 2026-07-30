import { NextResponse } from "next/server";

import { API_BASE_URL, requireSessionCookie, unauthorizedResponse } from "../../../../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    companyId: string;
    draftId: string;
  }>;
};

async function proxyDraftCsv(context: RouteContext, suffix: string) {
  const { companyId, draftId } = await context.params;
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/companies/${companyId}/labor-pay-billing/drafts/${draftId}/${suffix}`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store"
    }
  );

  if (!apiResponse.ok) {
    const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(payload, { status: apiResponse.status });
  }

  const buffer = await apiResponse.arrayBuffer();
  const contentDisposition =
    apiResponse.headers.get("content-disposition") ?? `attachment; filename="${suffix}"`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": contentDisposition
    }
  });
}

export async function GET(_request: Request, context: RouteContext) {
  return proxyDraftCsv(context, "client-billing.csv");
}
