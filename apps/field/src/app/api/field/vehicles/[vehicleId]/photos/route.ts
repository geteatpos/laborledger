import { NextResponse } from "next/server";

import {
  fieldPhotosErrorMessage,
  isFieldPhotosConfigured,
  listFieldVehiclePhotos,
  uploadFieldVehiclePhoto,
  workerCompanyId
} from "@/lib/field-photos-client";
import type { FieldVehiclePhotoCategory } from "@/lib/field-photos-client";
import { requireFieldSession } from "@/lib/field-route-auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ vehicleId: string }> }
) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldPhotosConfigured(auth.session)) {
    return NextResponse.json({ message: fieldPhotosErrorMessage() }, { status: 503 });
  }

  const { vehicleId } = await context.params;
  if (!vehicleId || vehicleId.trim().length === 0) {
    return NextResponse.json({ message: "Vehicle is required." }, { status: 400 });
  }

  const url = new URL(request.url);
  const workOrderIdRaw = url.searchParams.get("workOrderId") ?? "";
  const workOrderId = workOrderIdRaw.trim() ? workOrderIdRaw : undefined;
  const categoryParam = (url.searchParams.get("category") ?? "").trim();
  const category = (categoryParam || undefined) as FieldVehiclePhotoCategory | undefined;

  const result = await listFieldVehiclePhotos(auth.session, vehicleId, {
    workOrderId,
    category
  });

  return NextResponse.json(result.payload, { status: result.status });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ vehicleId: string }> }
) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldPhotosConfigured(auth.session)) {
    return NextResponse.json({ message: fieldPhotosErrorMessage() }, { status: 503 });
  }

  const { vehicleId } = await context.params;
  if (!vehicleId || vehicleId.trim().length === 0) {
    return NextResponse.json({ message: "Vehicle is required." }, { status: 400 });
  }

  const companyId = workerCompanyId(auth.session);
  if (!companyId) {
    return NextResponse.json(
      { message: fieldPhotosErrorMessage() },
      { status: 503 }
    );
  }

  const incoming = await request.formData();
  const file = incoming.get("photo");
  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { message: "Photo file is required." },
      { status: 400 }
    );
  }

  const workOrderId = (incoming.get("workOrderId")?.toString() ?? "").trim();
  const category = (incoming.get("category")?.toString() ?? "") as FieldVehiclePhotoCategory;
  const angleRaw = (incoming.get("angle")?.toString() ?? "").trim();
  const caption = (incoming.get("caption")?.toString() ?? "").trim();

  const formData = new FormData();
  formData.append("photo", file);
  formData.append("companyId", companyId);
  formData.append("pin", auth.session.pin);
  if (workOrderId) formData.append("workOrderId", workOrderId);
  formData.append("category", category);
  if (angleRaw) formData.append("angle", angleRaw);
  if (caption) formData.append("caption", caption);

  const result = await uploadFieldVehiclePhoto(vehicleId, formData);

  return NextResponse.json(result.payload, { status: result.status });
}
