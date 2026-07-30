import { NextResponse } from "next/server";

import {
  API_BASE_URL,
  formatApiMessage,
  requireSessionCookie,
  unauthorizedResponse
} from "../../../../../../../../lib/api-bff";

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

  const path = `/company-operations/companies/${encodeURIComponent(companyId)}/employees/${encodeURIComponent(employeeId)}/photo`;

  const apiResponse = await fetch(`${API_BASE_URL}${path}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store"
  });

  if (!apiResponse.ok) {
    const payload = (await apiResponse.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to load employee photo.") },
      { status: apiResponse.status }
    );
  }

  // For image responses, we need to pass through the content-type and the body
  const contentType = apiResponse.headers.get("content-type") ?? "image/jpeg";
  const imageBuffer = await apiResponse.arrayBuffer();

  return new NextResponse(imageBuffer, {
    status: apiResponse.status,
    headers: {
      "Content-Type": contentType
    }
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { companyId, employeeId } = await context.params;

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  // For file uploads, we need to forward the multipart form data
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json(
      { message: "No file provided." },
      { status: 400 }
    );
  }

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { message: "Invalid file type. Allowed: JPEG, PNG, WebP." },
      { status: 400 }
    );
  }

  // Validate file size (5MB max)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return NextResponse.json(
      { message: "File too large. Maximum size: 5MB." },
      { status: 400 }
    );
  }

  // Create a new FormData to forward to the API.
  // Re-encode the file so Nest/multer always receives a named multipart part.
  const apiFormData = new FormData();
  const bytes = await file.arrayBuffer();
  apiFormData.append(
    "file",
    new Blob([bytes], { type: file.type || "application/octet-stream" }),
    file.name || "photo.jpg"
  );

  const path = `/company-operations/companies/${encodeURIComponent(companyId)}/employees/${encodeURIComponent(employeeId)}/photo`;

  let apiResponse: Response;
  try {
    apiResponse = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { cookie: cookieHeader },
      body: apiFormData,
      cache: "no-store"
    });
  } catch {
    return NextResponse.json(
      { message: "Unable to reach API while uploading employee photo." },
      { status: 502 }
    );
  }

  const payload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to upload employee photo.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { companyId, employeeId } = await context.params;

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const path = `/company-operations/companies/${encodeURIComponent(companyId)}/employees/${encodeURIComponent(employeeId)}/photo`;

  const apiResponse = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    headers: { cookie: cookieHeader },
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to delete employee photo.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}
