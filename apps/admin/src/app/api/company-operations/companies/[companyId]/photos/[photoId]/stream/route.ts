import { NextResponse } from "next/server";

import {
  API_BASE_URL,
  requireSessionCookie,
  unauthorizedResponse
} from "../../../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    companyId: string;
    photoId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { companyId, photoId } = await context.params;

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/companies/${encodeURIComponent(companyId)}/photos/${encodeURIComponent(photoId)}/stream`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store"
    }
  );

  if (!apiResponse.ok || !apiResponse.body) {
    const payload = (await apiResponse.json().catch(() => ({}))) as {
      message?: string;
    };
    return NextResponse.json(
      { message: payload.message ?? "Failed to load photo." },
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
