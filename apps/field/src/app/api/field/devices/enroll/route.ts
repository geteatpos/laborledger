import { NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.enrollmentToken !== "string" || typeof body.androidId !== "string") {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const { enrollmentToken, androidId } = body;

  if (enrollmentToken.length > 256 || androidId.length > 256) {
    return NextResponse.json({ message: "Invalid token or device ID" }, { status: 400 });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/mobile/devices/enroll`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enrollmentToken: enrollmentToken.trim(),
        androidId: androidId.trim()
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to enroll device" }, { status: 500 });
  }
}
