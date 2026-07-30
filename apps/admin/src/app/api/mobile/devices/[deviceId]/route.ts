import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

function formatApiMessage(payload: { message?: string | string[] }, fallback: string) {
  if (Array.isArray(payload.message)) {
    return payload.message.join(" ");
  }
  return payload.message ?? fallback;
}

async function requireSessionCookie() {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader.includes("laborledger.sid=")) {
    return null;
  }
  return cookieHeader;
}

function unauthorizedResponse() {
  return NextResponse.json({ message: "Authentication required." }, { status: 401 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const { deviceId } = await params;
  const body = await request.json().catch(() => null);

  try {
    const response = await fetch(`${API_BASE_URL}/mobile/devices/${deviceId}/revoke`, {
      method: "POST",
      headers: {
        cookie: cookieHeader,
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    if (!response.ok) {
      return NextResponse.json(
        { message: formatApiMessage(payload, "Failed to revoke device") },
        { status: response.status }
      );
    }

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
