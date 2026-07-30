import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type {
  VehiclePhoto,
  VehiclePhotoAngle,
  VehiclePhotoCategory,
  WorkOrder
} from "@prisma/client";

import { PrismaService } from "../identity-access/prisma.service";
import { CompanyScopeService } from "../identity-access/company-scope.service";
import { StorageService } from "../storage/storage.service";

const ALLOWED_CATEGORIES: ReadonlyArray<VehiclePhotoCategory> = [
  "RECEPTION",
  "EXTERIOR",
  "INTERIOR",
  "DAMAGE",
  "PART"
];

const ALLOWED_ANGLES: ReadonlyArray<VehiclePhotoAngle> = [
  "FRONT",
  "REAR",
  "DRIVER_SIDE",
  "PASSENGER_SIDE",
  "TOP",
  "DETAIL",
  "OTHER"
];

export type UploadPhotoInput = {
  companyId: string;
  groupId: string;
  vehicleId: string;
  workOrderId?: string | undefined;
  uploadedByEmployeeId?: string | undefined;
  uploadedByUserId?: string | undefined;
  category: VehiclePhotoCategory;
  angle?: VehiclePhotoAngle | undefined;
  originalFilename: string;
  buffer: Buffer;
  mimeType: string;
  caption?: string | undefined;
  capturedAt?: Date | undefined;
};

export type ListPhotosInput = {
  companyId: string;
  vehicleId: string;
  workOrderId?: string | undefined;
  category?: VehiclePhotoCategory | undefined;
};

export type StreamPhotoResult = {
  absolutePath: string;
  mimeType: string;
};

@Injectable()
export class VehiclePhotoService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storageService: StorageService,
    @Inject(CompanyScopeService)
    private readonly companyScopeService: CompanyScopeService
  ) {}

  async uploadPhoto(input: UploadPhotoInput): Promise<VehiclePhoto> {
    const category = input.category;
    if (!ALLOWED_CATEGORIES.includes(category)) {
      throw new NotFoundException("Photo category is not allowed.");
    }

    if (input.angle && !ALLOWED_ANGLES.includes(input.angle)) {
      throw new NotFoundException("Photo angle is not allowed.");
    }

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: input.vehicleId, companyId: input.companyId },
      select: { id: true, groupId: true, companyId: true }
    });

    if (!vehicle) {
      throw new NotFoundException("Vehicle not found.");
    }

    let workOrder: Pick<WorkOrder, "id" | "vehicleId" | "locationId"> | null =
      null;
    if (input.workOrderId) {
      workOrder = await this.prisma.workOrder.findFirst({
        where: { id: input.workOrderId, companyId: input.companyId },
        select: { id: true, vehicleId: true, locationId: true }
      });

      if (!workOrder) {
        throw new NotFoundException("Work order not found.");
      }

      if (workOrder.vehicleId !== input.vehicleId) {
        throw new NotFoundException("Work order does not belong to this vehicle.");
      }
    }

    const { filePath, sizeBytes } = await this.storageService.saveFile({
      groupId: vehicle.groupId,
      companyId: vehicle.companyId,
      vehicleId: vehicle.id,
      category: photoCategoryToFolder(category),
      originalFilename: input.originalFilename,
      buffer: input.buffer,
      mimeType: input.mimeType
    });

    return this.prisma.vehiclePhoto.create({
      data: {
        groupId: vehicle.groupId,
        companyId: vehicle.companyId,
        vehicleId: vehicle.id,
        workOrderId: workOrder?.id ?? null,
        uploadedByEmployeeId: input.uploadedByEmployeeId ?? null,
        uploadedByUserId: input.uploadedByUserId ?? null,
        category,
        angle: input.angle ?? null,
        filePath,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        sizeBytes,
        caption: input.caption ?? null,
        capturedAt: input.capturedAt ?? null
      }
    });
  }

  async listPhotos(input: ListPhotosInput): Promise<VehiclePhoto[]> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: input.vehicleId, companyId: input.companyId },
      select: { id: true }
    });

    if (!vehicle) {
      throw new NotFoundException("Vehicle not found.");
    }

    const where: {
      companyId: string;
      vehicleId: string;
      workOrderId?: string;
      category?: VehiclePhotoCategory;
      deletedAt: null;
    } = {
      companyId: input.companyId,
      vehicleId: vehicle.id,
      deletedAt: null
    };

    if (input.workOrderId) {
      where.workOrderId = input.workOrderId;
    }
    if (input.category) {
      where.category = input.category;
    }

    return this.prisma.vehiclePhoto.findMany({
      where,
      orderBy: { uploadedAt: "desc" }
    });
  }

  async listPhotosForAdmin(
    principal: import("../identity-access/auth.types").AuthenticatedPrincipal,
    input: ListPhotosInput
  ): Promise<VehiclePhoto[]> {
    const context = await this.companyScopeService.getCompanyAccessContext(
      principal,
      input.companyId
    );

    if (input.workOrderId) {
      const workOrder = await this.prisma.workOrder.findFirst({
        where: { id: input.workOrderId, companyId: input.companyId },
        select: { id: true, vehicleId: true, locationId: true }
      });
      if (!workOrder) {
        throw new NotFoundException("Work order not found.");
      }
      if (workOrder.vehicleId !== input.vehicleId) {
        throw new NotFoundException("Work order does not belong to this vehicle.");
      }
      if (
        !context.unrestrictedLocations &&
        !context.allowedLocationIds.includes(workOrder.locationId)
      ) {
        throw new ForbiddenException(
          "Supervisor is not assigned to this location."
        );
      }
    }

    return this.listPhotos({ ...input, vehicleId: input.vehicleId });
  }

  async getPhotoStream(input: {
    photoId: string;
    companyId: string;
  }): Promise<StreamPhotoResult> {
    const photo = await this.prisma.vehiclePhoto.findFirst({
      where: {
        id: input.photoId,
        companyId: input.companyId,
        deletedAt: null
      },
      select: { id: true, filePath: true, mimeType: true }
    });

    if (!photo) {
      throw new NotFoundException("Photo not found.");
    }

    const absolutePath = await this.storageService.resolveAbsolutePath(
      photo.filePath
    );
    return { absolutePath, mimeType: photo.mimeType };
  }

  async getPhotoStreamForAdmin(
    principal: import("../identity-access/auth.types").AuthenticatedPrincipal,
    input: { photoId: string; companyId: string }
  ): Promise<StreamPhotoResult & { workOrderLocationId: string | null }> {
    const photo = await this.prisma.vehiclePhoto.findFirst({
      where: {
        id: input.photoId,
        companyId: input.companyId,
        deletedAt: null
      },
      select: {
        id: true,
        filePath: true,
        mimeType: true,
        workOrder: { select: { locationId: true } }
      }
    });

    if (!photo) {
      throw new NotFoundException("Photo not found.");
    }

    if (photo.workOrder?.locationId) {
      const context = await this.companyScopeService.getCompanyAccessContext(
        principal,
        input.companyId
      );
      if (
        !context.unrestrictedLocations &&
        !context.allowedLocationIds.includes(photo.workOrder.locationId)
      ) {
        throw new ForbiddenException(
          "Supervisor is not assigned to this location."
        );
      }
    }

    const absolutePath = await this.storageService.resolveAbsolutePath(
      photo.filePath
    );
    return {
      absolutePath,
      mimeType: photo.mimeType,
      workOrderLocationId: photo.workOrder?.locationId ?? null
    };
  }

  async softDeletePhoto(
    principal: import("../identity-access/auth.types").AuthenticatedPrincipal,
    input: { photoId: string; companyId: string }
  ): Promise<VehiclePhoto> {
    const context = await this.companyScopeService.getCompanyAccessContext(
      principal,
      input.companyId
    );
    if (!context.canManageCompany) {
      throw new ForbiddenException(
        "Only company admins and group owners can delete photos."
      );
    }

    const existing = await this.prisma.vehiclePhoto.findFirst({
      where: { id: input.photoId, companyId: input.companyId },
      select: { id: true, deletedAt: true }
    });

    if (!existing) {
      throw new NotFoundException("Photo not found.");
    }

    if (existing.deletedAt) {
      return this.prisma.vehiclePhoto.findUniqueOrThrow({
        where: { id: existing.id }
      });
    }

    return this.prisma.vehiclePhoto.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() }
    });
  }
}

function photoCategoryToFolder(
  category: VehiclePhotoCategory
): "reception" | "exterior" | "interior" | "damage" | "part" {
  switch (category) {
    case "RECEPTION":
      return "reception";
    case "EXTERIOR":
      return "exterior";
    case "INTERIOR":
      return "interior";
    case "DAMAGE":
      return "damage";
    case "PART":
      return "part";
  }
}
