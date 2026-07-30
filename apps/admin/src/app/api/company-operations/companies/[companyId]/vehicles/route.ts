import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

type CreateVehicleBody = {
  vin?: string;
  serviceClientId?: string;
  locationId?: string;
  plate?: string;
  color?: string;
  mileage?: number;
  notes?: string;
};

export async function GET(request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const serviceClientId = url.searchParams.get("serviceClientId");
  const q = url.searchParams.get("q");
  const includeArchived = url.searchParams.get("includeArchived");

  const query = new URLSearchParams();
  if (serviceClientId) query.set("serviceClientId", serviceClientId);
  if (q) query.set("q", q);
  if (includeArchived) query.set("includeArchived", includeArchived);
  const suffix = query.toString() ? `?${query.toString()}` : "";

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/companies/${companyId}/vehicles${suffix}`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as { message?: string | string[] };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to load vehicles.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}

export async function POST(request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const body = (await request.json().catch(() => null)) as CreateVehicleBody | null;
  const vin = body?.vin?.trim() ?? "";

  if (!vin) {
    return NextResponse.json({ message: "VIN is required." }, { status: 400 });
  }

  if (!body?.serviceClientId) {
    return NextResponse.json({ message: "Service client is required." }, { status: 400 });
  }

  if (!body?.locationId) {
    return NextResponse.json({ message: "Location is required." }, { status: 400 });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/companies/${companyId}/vehicles`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify({
      vin,
      serviceClientId: body.serviceClientId,
      locationId: body.locationId,
      plate: body.plate,
      color: body.color,
      mileage: body.mileage,
      notes: body.notes
    }),
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
    id?: string;
    vin?: string;
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to create vehicle.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(
    {
      vehicle: {
        id: responsePayload.id,
        vin: responsePayload.vin ?? vin.toUpperCase()
      }
    },
    { status: 201 }
  );
}
