import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../identity-access/prisma.service";
import { CompanyScopeService } from "../identity-access/company-scope.service";
import { EmployeePhotoStorageService } from "./employee-photo-storage.service";

export type UploadEmployeePhotoInput = {
  companyId: string;
  employeeId: string;
  originalFilename: string;
  buffer: Buffer;
  mimeType: string;
};

@Injectable()
export class EmployeePhotoService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanyScopeService)
    private readonly companyScopeService: CompanyScopeService,
    @Inject(EmployeePhotoStorageService)
    private readonly storageService: EmployeePhotoStorageService
  ) {}

  private async createAuditEvents(
    tx: Prisma.TransactionClient,
    data: Prisma.AuditEventCreateManyInput[]
  ) {
    if (data.length === 0) {
      return;
    }
    await tx.auditEvent.createMany({ data });
  }

  async uploadPhoto(
    principal: import("../identity-access/auth.types").AuthenticatedPrincipal,
    input: UploadEmployeePhotoInput
  ): Promise<{ photoUrl: string; photoUpdatedAt: Date }> {
    // Verify the employee exists and belongs to the company
    const employee = await this.prisma.employee.findFirst({
      where: { id: input.employeeId, companyId: input.companyId },
      select: { id: true, groupId: true, companyId: true, photoUrl: true }
    });

    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }

    // Verify principal has admin access to the company
    const context = await this.companyScopeService.getCompanyAccessContext(
      principal,
      input.companyId
    );

    if (!context.canManageCompany) {
      throw new ForbiddenException(
        "Only company admins can upload employee photos."
      );
    }

    const hadExistingPhoto = !!employee.photoUrl;

    // If there's an existing photo, delete it first
    if (hadExistingPhoto && employee.photoUrl) {
      try {
        await this.storageService.deletePhoto(employee.photoUrl);
      } catch {
        // Ignore errors deleting old photo
      }
    }

    // Save the new photo
    const { filePath } = await this.storageService.savePhoto({
      groupId: employee.groupId,
      companyId: employee.companyId,
      employeeId: employee.id,
      originalFilename: input.originalFilename,
      buffer: input.buffer,
      mimeType: input.mimeType
    });

    // Update the employee record and create audit event in transaction
    const photoUpdatedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employee.id },
        data: {
          photoUrl: filePath,
          photoUpdatedAt
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: hadExistingPhoto ? "EMPLOYEE_PHOTO_REPLACED" : "EMPLOYEE_PHOTO_UPLOADED",
          targetType: "Employee",
          targetId: employee.id,
          groupId: employee.groupId,
          companyId: employee.companyId,
          metadata: {
            photoAction: hadExistingPhoto ? "replaced" : "uploaded",
            mimeType: input.mimeType
          }
        }
      ]);
    });

    return { photoUrl: filePath, photoUpdatedAt };
  }

  async deletePhoto(
    principal: import("../identity-access/auth.types").AuthenticatedPrincipal,
    input: { employeeId: string; companyId: string }
  ): Promise<void> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: input.employeeId, companyId: input.companyId },
      select: { id: true, groupId: true, companyId: true, photoUrl: true }
    });

    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }

    const context = await this.companyScopeService.getCompanyAccessContext(
      principal,
      input.companyId
    );

    if (!context.canManageCompany) {
      throw new ForbiddenException(
        "Only company admins can delete employee photos."
      );
    }

    // Delete the photo file if it exists
    if (employee.photoUrl) {
      try {
        await this.storageService.deletePhoto(employee.photoUrl);
      } catch {
        // Ignore errors deleting photo
      }
    }

    // Clear the photo fields in the employee record and create audit event
    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employee.id },
        data: {
          photoUrl: null,
          photoUpdatedAt: null
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "EMPLOYEE_PHOTO_DELETED",
          targetType: "Employee",
          targetId: employee.id,
          groupId: employee.groupId,
          companyId: employee.companyId,
          metadata: {}
        }
      ]);
    });
  }

  async getPhotoStream(input: {
    employeeId: string;
    companyId: string;
  }): Promise<{ absolutePath: string; mimeType: string }> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: input.employeeId, companyId: input.companyId },
      select: { id: true, photoUrl: true }
    });

    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }

    if (!employee.photoUrl) {
      throw new NotFoundException("Employee has no photo.");
    }

    let absolutePath: string;
    try {
      absolutePath = await this.storageService.resolveAbsolutePath(
        employee.photoUrl
      );
    } catch {
      throw new NotFoundException("Employee photo file is missing.");
    }

    // Determine mime type from extension
    const ext = employee.photoUrl.toLowerCase().split(".").pop() ?? "";
    const mimeType = this.getMimeTypeForExtension(ext);

    return { absolutePath, mimeType };
  }

  async getPublicPhotoStream(
    employeeId: string
  ): Promise<{ absolutePath: string; mimeType: string }> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { photoUrl: true }
    });

    if (!employee || !employee.photoUrl) {
      throw new NotFoundException("Employee photo not found.");
    }

    let absolutePath: string;
    try {
      absolutePath = await this.storageService.resolveAbsolutePath(
        employee.photoUrl
      );
    } catch {
      throw new NotFoundException("Employee photo file is missing.");
    }

    const ext = employee.photoUrl.toLowerCase().split(".").pop() ?? "";
    const mimeType = this.getMimeTypeForExtension(ext);

    return { absolutePath, mimeType };
  }

  private getMimeTypeForExtension(ext: string): string {
    switch (ext) {
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "png":
        return "image/png";
      case "webp":
        return "image/webp";
      default:
        return "image/jpeg";
    }
  }
}
