import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage } from "../../../../../lib/api-bff";

function forwardedClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for")?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwardedFor || realIp || null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    newPassword?: string;
  };
  const forwardedFor = forwardedClientIp(request);

  const apiResponse = await fetch(`${API_BASE_URL}/auth/password-reset/confirm`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {})
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as { message?: string };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to reset password.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(responsePayload, { status: 200 });
}
