import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../lib/api-bff";
import { fetchAuthMe, WorkspaceApiError } from "../../../../lib/workspace-auth";

type MechanicOrderListItem = {
  id: string;
  workOrderNumber: string;
  status: string;
  createdAt: string;
  vehicle: {
    id: string;
    vin: string;
    year: number | null;
    make: string | null;
    model: string | null;
    plate: string | null;
    color: string | null;
  };
  mechanicParts: Array<{ id: string }>;
  mechanicApproval: {
    id: string;
    status: string;
    note: string | null;
    contactMethod: string | null;
    decidedAt: string | null;
    createdAt: string;
    supervisor: { id: string; fullName: string | null; email: string } | null;
  } | null;
};

type MechanicOrderListResponse = {
  orders: MechanicOrderListItem[];
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

export async function GET(request: Request) {
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const companyId = await resolveCompanyId(cookieHeader);
  if (!companyId) {
    return NextResponse.json({ orders: [] } satisfies MechanicOrderListResponse);
  }

  const status = new URL(request.url).searchParams.get("status") ?? "PENDING";
  const statusQuery =
    status === "APPROVED" || status === "REJECTED" || status === "ALL" || status === "PENDING"
      ? `?status=${encodeURIComponent(status)}`
      : "";

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/${encodeURIComponent(companyId)}/mechanic-orders${statusQuery}`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store"
    }
  );

  const responsePayload = (await apiResponse.json().catch(() => [])) as
    | MechanicOrderListItem[]
    | { message?: string | string[] };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload as { message?: string | string[] }, "Unable to load mechanic orders.") },
      { status: apiResponse.status }
    );
  }

  const list = Array.isArray(responsePayload) ? responsePayload : [];
  const body: MechanicOrderListResponse = { orders: list };
  return NextResponse.json(body, { status: 200 });
}
