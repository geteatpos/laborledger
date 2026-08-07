import { NextResponse } from "next/server";

import { readFieldSession, type FieldSessionData } from "@/lib/field-session";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

function resolveCompanyId(session: FieldSessionData | null): string | null {
  if (session?.companyId?.trim()) {
    return session.companyId.trim();
  }
  return process.env["WORKER_COMPANY_ID"]?.trim() || null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ photoId: string }> }
) {
  const session = await readFieldSession();
  const companyId = resolveCompanyId(session);

  if (!session || !companyId || !session.pin) {
    return NextResponse.json(
      { message: "Field session not configured." },
      { status: 503 }
    );
  }

  const { photoId } = await context.params;
  if (!photoId || photoId.trim().length === 0) {
    return NextResponse.json({ message: "Photo is required." }, { status: 400 });
  }

  const params = new URLSearchParams({
    companyId,
    pin: session.pin
  });

  const apiResponse = await fetch(
    `${API_BASE_URL}/worker/photos/${encodeURIComponent(photoId)}/stream?${params.toString()}`,
    { cache: "no-store" }
  );

  if (!apiResponse.ok || !apiResponse.body) {
    return NextResponse.json(
      { message: "Failed to load photo." },
      { status: apiResponse.status || 502 }
    );
  }

  const contentType = apiResponse.headers.get("content-type") ?? "application/octet-stream";
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "private, max-age=3600");

  return new Response(apiResponse.body, {
    status: 200,
    headers
  });
}
