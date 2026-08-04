import { NextResponse } from "next/server";

import { fieldLocationNotReadyMessage } from "@/lib/field-messages";
import { buildFieldSessionCookie, type FieldSessionData } from "@/lib/field-session";
import { resolveFieldRuntime } from "@/lib/field-runtime";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

function forwardedClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for")?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwardedFor || realIp || null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { pin?: string } | null;
  const pin = body?.pin ?? "";
  const runtime = await resolveFieldRuntime(request);
  const companyId = runtime.companyId;
  const forwardedFor = forwardedClientIp(request);

  if (!companyId || !runtime.pinLoginReady) {
    return NextResponse.json(
      { message: runtime.bootstrap.message ?? fieldLocationNotReadyMessage() },
      { status: 503 }
    );
  }

  if (!/^\d{6}$/u.test(pin)) {
    return NextResponse.json({ message: "Enter a 6-digit PIN." }, { status: 400 });
  }

  const apiResponse = await fetch(`${API_BASE_URL}/worker/lookup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {})
    },
    body: JSON.stringify({ companyId, pin }),
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string;
    employee?: { id?: string; fullName?: string };
    company?: { id?: string; name?: string };
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: payload.message ?? "Unable to sign in." },
      { status: apiResponse.status }
    );
  }

  const employeeId = payload.employee?.id?.trim() ?? "";
  const employeeName = payload.employee?.fullName?.trim() ?? "";
  const resolvedCompanyId = payload.company?.id?.trim() ?? "";
  const companyName = payload.company?.name?.trim() ?? "";

  if (!employeeId || !employeeName || !resolvedCompanyId || !companyName) {
    return NextResponse.json({ message: "Sign-in response was incomplete." }, { status: 502 });
  }

  if (resolvedCompanyId !== companyId) {
    return NextResponse.json({ message: "Sign-in company mismatch." }, { status: 403 });
  }

  const sessionData: FieldSessionData = {
    employeeId,
    employeeName,
    companyId: resolvedCompanyId,
    companyName,
    locationId: runtime.locationId ?? undefined,
    locationName: runtime.bootstrap.location?.name,
    pin,
    issuedAt: Date.now()
  };

  const response = NextResponse.json({
    employeeName,
    companyName,
    redirectTo: "/field/home"
  });
  response.cookies.set(buildFieldSessionCookie(sessionData));
  return response;
}
