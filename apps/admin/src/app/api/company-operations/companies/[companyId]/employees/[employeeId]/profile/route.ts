import { NextResponse } from "next/server";

import {
  API_BASE_URL,
  formatApiMessage,
  requireSessionCookie,
  unauthorizedResponse
} from "../../../../../../../../lib/api-bff";

export type EmployeeProfileResponse = {
  id: string;
  fullName: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  photoUrl: string | null;
  photoUpdatedAt: string | null;
  phone: string | null;
  email: string | null;
  title: string | null;
  department: string | null;
  hireDate: string | null;
  terminationDate: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateOrRegion: string | null;
  postalCode: string | null;
  countryCode: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
};

type UpdateEmployeeProfileBody = {
  phone?: string | null;
  email?: string | null;
  title?: string | null;
  department?: string | null;
  hireDate?: string | null;
  terminationDate?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateOrRegion?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
};

type RouteContext = {
  params: Promise<{
    companyId: string;
    employeeId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { companyId, employeeId } = await context.params;

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/companies/${encodeURIComponent(companyId)}/employees/${encodeURIComponent(employeeId)}/profile`,
    {
      method: "GET",
      headers: {
        cookie: cookieHeader
      },
      cache: "no-store"
    }
  );

  if (!apiResponse.ok) {
    const payload = (await apiResponse.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to load employee profile.") },
      { status: apiResponse.status }
    );
  }

  const profile = (await apiResponse.json().catch(() => null)) as EmployeeProfileResponse | null;
  if (!profile) {
    return NextResponse.json(
      { message: "Invalid response from API." },
      { status: 502 }
    );
  }

  return NextResponse.json(profile);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { companyId, employeeId } = await context.params;
  const body = (await request.json().catch(() => null)) as UpdateEmployeeProfileBody | null;

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/companies/${encodeURIComponent(companyId)}/employees/${encodeURIComponent(employeeId)}/profile`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader
      },
      body: JSON.stringify(body ?? {}),
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to update employee profile.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}
