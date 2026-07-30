import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import QRCode from "qrcode";

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

export async function GET(request: Request) {
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const locationId = searchParams.get("locationId");

  if (!companyId) {
    return NextResponse.json({ message: "companyId is required" }, { status: 400 });
  }

  const query = new URLSearchParams({ companyId });
  if (locationId) {
    query.set("locationId", locationId);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/mobile/devices?${query.toString()}`, {
      headers: { cookie: cookieHeader },
      cache: "no-store"
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      return NextResponse.json(
        { message: formatApiMessage(payload, "Failed to fetch devices") },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ message: "Request body must be an object." }, { status: 400 });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/mobile/devices/enrollment-tokens`, {
      method: "POST",
      headers: {
        cookie: cookieHeader,
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const payload = (await response.json().catch(() => ({}))) as {
      message?: string | string[];
      enrollmentToken?: string;
      token?: unknown;
    };

    if (!response.ok) {
      return NextResponse.json(
        { message: formatApiMessage(payload, "Failed to create enrollment token") },
        { status: response.status }
      );
    }

    const enrollmentToken =
      typeof payload.enrollmentToken === "string" ? payload.enrollmentToken : "";
    if (!enrollmentToken) {
      return NextResponse.json(
        { message: "Enrollment token missing from API response." },
        { status: 502 }
      );
    }

    const qrCode = await QRCode.toDataURL(enrollmentToken, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 256,
      type: "image/png"
    });

    return NextResponse.json(
      {
        enrollmentToken,
        qrCode,
        token: payload.token
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
