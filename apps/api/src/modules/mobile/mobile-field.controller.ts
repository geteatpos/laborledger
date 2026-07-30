import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { ChecklistItemStatus, VehiclePhotoAngle, VehiclePhotoCategory } from "@prisma/client";

import { CurrentMobileSession } from "./current-mobile-session.decorator";
import type { MobileSessionContext } from "./mobile-contracts";
import { MobileBearerGuard } from "./mobile-bearer.guard";
import { MobileFieldService } from "./mobile-field.service";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_CHECKLIST_STATUSES: ChecklistItemStatus[] = ["OK", "NEEDS_ATTENTION", "NA"];

const photoUpload = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES },
  fileFilter: (
    _req: unknown,
    file: { mimetype: string },
    cb: (err: Error | null, accept: boolean) => void
  ) => {
    if (!file.mimetype?.startsWith("image/")) {
      cb(new Error("Only image files are allowed"), false);
      return;
    }
    cb(null, true);
  }
};

type IdempotencyBody = { idempotencyKey?: string };

type CreateJobBody = {
  enteredVin?: string;
  serviceClientId?: string;
  locationId?: string;
  serviceCatalogItemId?: string;
  notes?: string;
};

type DecodeVinBody = { vin?: string };

type CreateChecklistBody = { workOrderId?: string };

type PatchChecklistItemBody = {
  status?: ChecklistItemStatus;
  notes?: string;
  measurementValue?: number;
  measurementUnit?: string;
};

type LaborWorkStartBody = {
  serviceClientId?: string;
  locationId?: string;
  serviceCatalogItemId?: string;
  vehicleId?: string;
  vin?: string;
  notes?: string;
  workOrderId?: string;
  workOrderServiceLineId?: string;
};

type LaborWorkProgressBody = {
  progressPercent?: number;
  referenceAction?: "prep_start" | "prep_complete" | "wash_start" | "wash_complete";
  notes?: string;
};

type LaborWorkBlockBody = { blockedReason?: string };

@Controller("mobile/field")
@UseGuards(MobileBearerGuard)
export class MobileFieldController {
  constructor(@Inject(MobileFieldService) private readonly mobileField: MobileFieldService) {}

  @Get("clock/status")
  clockStatus(@CurrentMobileSession() session: MobileSessionContext) {
    return this.mobileField.clockStatus(session);
  }

  @Post("clock/in")
  @HttpCode(200)
  clockIn(@CurrentMobileSession() session: MobileSessionContext, @Body() body: IdempotencyBody) {
    return this.mobileField.clockAction(session, "clock_in", body.idempotencyKey ?? "");
  }

  @Post("clock/out")
  @HttpCode(200)
  clockOut(@CurrentMobileSession() session: MobileSessionContext, @Body() body: IdempotencyBody) {
    return this.mobileField.clockAction(session, "clock_out", body.idempotencyKey ?? "");
  }

  @Post("break/start")
  @HttpCode(200)
  breakStart(@CurrentMobileSession() session: MobileSessionContext, @Body() body: IdempotencyBody) {
    return this.mobileField.clockAction(session, "break_start", body.idempotencyKey ?? "");
  }

  @Post("break/end")
  @HttpCode(200)
  breakEnd(@CurrentMobileSession() session: MobileSessionContext, @Body() body: IdempotencyBody) {
    return this.mobileField.clockAction(session, "break_end", body.idempotencyKey ?? "");
  }

  @Get("jobs/options")
  jobOptions(@CurrentMobileSession() session: MobileSessionContext) {
    return this.mobileField.jobOptions(session);
  }

  @Post("jobs/decode-vin")
  @HttpCode(200)
  decodeVin(@CurrentMobileSession() session: MobileSessionContext, @Body() body: DecodeVinBody) {
    return this.mobileField.decodeVin(session, body.vin ?? "");
  }

  @Post("jobs")
  @HttpCode(200)
  createJob(@CurrentMobileSession() session: MobileSessionContext, @Body() body: CreateJobBody) {
    return this.mobileField.createJob(session, body);
  }

  @Post("checklist")
  @HttpCode(200)
  createChecklist(
    @CurrentMobileSession() session: MobileSessionContext,
    @Body() body: CreateChecklistBody
  ) {
    return this.mobileField.createChecklist(session, body.workOrderId ?? "");
  }

  @Get("checklist/:id")
  getChecklist(@CurrentMobileSession() session: MobileSessionContext, @Param("id") id: string) {
    return this.mobileField.getChecklist(session, id);
  }

  @Patch("checklist/:id/items/:itemId")
  patchChecklistItem(
    @CurrentMobileSession() session: MobileSessionContext,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() body: PatchChecklistItemBody
  ) {
    const status = body.status;
    if (!status || !ALLOWED_CHECKLIST_STATUSES.includes(status)) {
      throw new BadRequestException("Item status must be OK, NEEDS_ATTENTION, or NA.");
    }

    const update: {
      status: ChecklistItemStatus;
      notes?: string | null;
      measurementValue?: number | null;
      measurementUnit?: string | null;
    } = { status };

    if (body.notes != null) {
      update.notes = body.notes.trim() ? body.notes.trim() : null;
    }
    if (body.measurementValue !== undefined) {
      update.measurementValue =
        typeof body.measurementValue === "number" ? body.measurementValue : null;
    }
    if (body.measurementUnit != null) {
      update.measurementUnit = body.measurementUnit.trim() ? body.measurementUnit.trim() : null;
    }

    return this.mobileField.patchChecklistItem(session, id, itemId, update);
  }

  @Post("checklist/:id/complete")
  @HttpCode(200)
  completeChecklist(@CurrentMobileSession() session: MobileSessionContext, @Param("id") id: string) {
    return this.mobileField.completeChecklist(session, id);
  }

  @Get("labor-work/active")
  laborWorkActive(@CurrentMobileSession() session: MobileSessionContext) {
    return this.mobileField.laborWorkActive(session);
  }

  @Get("labor-work/available-options")
  laborWorkOptions(@CurrentMobileSession() session: MobileSessionContext) {
    return this.mobileField.laborWorkOptions(session);
  }

  @Post("labor-work/start")
  @HttpCode(200)
  laborWorkStart(
    @CurrentMobileSession() session: MobileSessionContext,
    @Body() body: LaborWorkStartBody
  ) {
    return this.mobileField.laborWorkStart(session, body);
  }

  @Patch("labor-work/:id/progress")
  laborWorkProgress(
    @CurrentMobileSession() session: MobileSessionContext,
    @Param("id") id: string,
    @Body() body: LaborWorkProgressBody
  ) {
    return this.mobileField.laborWorkProgress(session, id, body);
  }

  @Post("labor-work/:id/complete")
  @HttpCode(200)
  laborWorkComplete(@CurrentMobileSession() session: MobileSessionContext, @Param("id") id: string) {
    return this.mobileField.laborWorkComplete(session, id);
  }

  @Post("labor-work/:id/block")
  @HttpCode(200)
  laborWorkBlock(
    @CurrentMobileSession() session: MobileSessionContext,
    @Param("id") id: string,
    @Body() body: LaborWorkBlockBody
  ) {
    return this.mobileField.laborWorkBlock(session, id, body.blockedReason ?? "");
  }

  @Post("labor-work/:id/cancel")
  @HttpCode(200)
  laborWorkCancel(@CurrentMobileSession() session: MobileSessionContext, @Param("id") id: string) {
    return this.mobileField.laborWorkCancel(session, id);
  }

  @Get("vehicles/:vehicleId/photos")
  listPhotos(
    @CurrentMobileSession() session: MobileSessionContext,
    @Param("vehicleId") vehicleId: string,
    @Query("workOrderId") workOrderId?: string,
    @Query("category") category?: VehiclePhotoCategory
  ) {
    return this.mobileField.listPhotos(session, vehicleId, {
      workOrderId: workOrderId?.trim() || undefined,
      category
    });
  }

  @Post("vehicles/:vehicleId/photos")
  @HttpCode(200)
  @UseInterceptors(FileInterceptor("photo", photoUpload))
  uploadPhoto(
    @CurrentMobileSession() session: MobileSessionContext,
    @Param("vehicleId") vehicleId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body()
    body: {
      workOrderId?: string;
      category?: VehiclePhotoCategory;
      angle?: VehiclePhotoAngle;
      caption?: string;
    }
  ) {
    if (!file) {
      throw new BadRequestException("Photo file is required.");
    }

    return this.mobileField.uploadPhoto(session, vehicleId, {
      file: {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype
      },
      workOrderId: body.workOrderId?.trim() || undefined,
      category: body.category,
      angle: body.angle,
      caption: body.caption?.trim() || undefined
    });
  }
}
