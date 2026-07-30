import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { VehiclePhotoAngle, VehiclePhotoCategory } from "@prisma/client";

type ExpressLikeResponse = NodeJS.WritableStream & {
  setHeader(name: string, value: string | number): void;
};

import { AuthenticatedGuard } from "../identity-access/authenticated.guard";
import type { AuthenticatedPrincipal } from "../identity-access/auth.types";
import { CurrentPrincipal } from "../identity-access/current-principal.decorator";
import { GroupAccessService } from "../identity-access/group-access.service";
import { PrismaService } from "../identity-access/prisma.service";
import { resolveEmployeeByPin } from "../worker/worker-auth.helper";

import { VehiclePhotoService } from "./vehicle-photo.service";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

type WorkerPhotoAuthBody = {
  companyId?: string;
  pin?: string;
};

type WorkerPhotoUploadBody = WorkerPhotoAuthBody & {
  workOrderId?: string;
  category?: VehiclePhotoCategory;
  angle?: VehiclePhotoAngle;
  caption?: string;
};

type WorkerPhotoListQuery = WorkerPhotoAuthBody & {
  workOrderId?: string;
  category?: VehiclePhotoCategory;
};

type AdminPhotoListQuery = {
  workOrderId?: string;
  category?: VehiclePhotoCategory;
};

const upload = {
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

@Controller("worker")
export class WorkerVehiclePhotoController {
  constructor(
    @Inject(VehiclePhotoService)
    private readonly photoService: VehiclePhotoService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GroupAccessService)
    private readonly groupAccessService: GroupAccessService
  ) {}

  @Post("vehicles/:vehicleId/photos")
  @UseInterceptors(FileInterceptor("photo", upload))
  async uploadPhoto(
    @Param("vehicleId") vehicleId: string,
    @Body() body: WorkerPhotoUploadBody,
    @UploadedFile() file: Express.Multer.File | undefined
  ) {
    if (!file) {
      throw new BadRequestException("Photo file is required.");
    }

    const companyId = body.companyId?.trim() ?? "";
    if (!companyId) {
      throw new NotFoundException("Company is required.");
    }

    await this.groupAccessService.assertCompanyTenantOperational(companyId);
    await resolveEmployeeByPin(this.prisma, companyId, body.pin ?? "");

    const category = body.category;
    if (!category) {
      throw new BadRequestException("Photo category is required.");
    }

    return this.photoService.uploadPhoto({
      companyId,
      groupId: "",
      vehicleId,
      workOrderId: body.workOrderId,
      category,
      angle: body.angle,
      caption: body.caption,
      capturedAt: undefined,
      originalFilename: file.originalname || "photo.jpg",
      buffer: file.buffer,
      mimeType: file.mimetype || "application/octet-stream"
    });
  }

  @Get("vehicles/:vehicleId/photos")
  async listPhotos(
    @Param("vehicleId") vehicleId: string,
    @Query() query: WorkerPhotoListQuery
  ) {
    const companyId = query.companyId?.trim() ?? "";
    if (!companyId) {
      throw new NotFoundException("Company is required.");
    }

    await this.groupAccessService.assertCompanyTenantOperational(companyId);
    await resolveEmployeeByPin(this.prisma, companyId, query.pin ?? "");

    return this.photoService.listPhotos({
      companyId,
      vehicleId,
      workOrderId: query.workOrderId,
      category: query.category
    });
  }

  @Get("photos/:photoId/stream")
  async streamPhoto(
    @Param("photoId") photoId: string,
    @Query() query: WorkerPhotoAuthBody,
    @Res() res: ExpressLikeResponse
  ) {
    const companyId = query.companyId?.trim() ?? "";
    if (!companyId) {
      throw new NotFoundException("Company is required.");
    }

    await this.groupAccessService.assertCompanyTenantOperational(companyId);
    await resolveEmployeeByPin(this.prisma, companyId, query.pin ?? "");

    const result = await this.photoService.getPhotoStream({
      photoId,
      companyId
    });

    res.setHeader("Content-Type", result.mimeType);
    res.setHeader("Cache-Control", "private, max-age=3600");

    const stream = await import("node:fs").then((m) =>
      m.createReadStream(result.absolutePath)
    );
    stream.pipe(res);

    return undefined;
  }
}

@Controller("company-operations")
@UseGuards(AuthenticatedGuard)
export class AdminVehiclePhotoController {
  constructor(
    @Inject(VehiclePhotoService)
    private readonly photoService: VehiclePhotoService
  ) {}

  @Get("companies/:companyId/vehicles/:vehicleId/photos")
  listPhotos(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Param("vehicleId") vehicleId: string,
    @Query() query: AdminPhotoListQuery
  ) {
    return this.photoService.listPhotosForAdmin(principal, {
      companyId,
      vehicleId,
      workOrderId: query.workOrderId,
      category: query.category
    });
  }

  @Get("companies/:companyId/photos/:photoId/stream")
  async streamPhoto(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Param("photoId") photoId: string,
    @Res() res: ExpressLikeResponse
  ) {
    const result = await this.photoService.getPhotoStreamForAdmin(principal, {
      photoId,
      companyId
    });

    res.setHeader("Content-Type", result.mimeType);
    res.setHeader("Cache-Control", "private, max-age=3600");

    const stream = await import("node:fs").then((m) =>
      m.createReadStream(result.absolutePath)
    );
    stream.pipe(res);

    return undefined;
  }

  @Delete("companies/:companyId/photos/:photoId")
  deletePhoto(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Param("photoId") photoId: string
  ) {
    return this.photoService.softDeletePhoto(principal, {
      photoId,
      companyId
    });
  }
}
