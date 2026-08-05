import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { ChecklistItemStatus, VehiclePhotoAngle, VehiclePhotoCategory } from "@prisma/client";

import { FieldBootstrapService } from "../field/field-bootstrap.service";
import { GroupAccessService } from "../identity-access/group-access.service";
import { PrismaService } from "../identity-access/prisma.service";
import { KioskPunchService } from "../kiosk/kiosk-punch.service";
import { LaborWorkAssignmentService } from "../labor-work-assignment/labor-work-assignment.service";
import { VehicleInspectionService } from "../vehicle-inspection/vehicle-inspection.service";
import { VehiclePhotoService } from "../vehicle-photos/vehicle-photo.service";
import { FieldJobService } from "../worker/field-job.service";

import type { MobileSessionContext } from "./mobile-contracts";

function formatShiftStatus(punchState?: string): string {
  switch (punchState) {
    case "scheduled":
      return "Not clocked in";
    case "clocked_in":
      return "On shift";
    case "on_break":
      return "On break";
    case "clocked_out":
      return "Clocked out";
    default:
      return "Unknown";
  }
}

function mapFieldClockStatus(payload: {
  employeeName?: string;
  punchState?: string;
  allowedActions?: string[];
  workedMinutes?: number | null;
  warnings?: string[];
  timezone?: string;
  scheduledStartUtc?: string;
  scheduledEndUtc?: string;
  duplicate?: boolean;
  message?: string;
}) {
  return {
    employeeName: payload.employeeName ?? null,
    shiftStatus: formatShiftStatus(payload.punchState),
    punchState: payload.punchState ?? null,
    allowedActions: payload.allowedActions ?? [],
    workedMinutes: payload.workedMinutes ?? null,
    warnings: payload.warnings ?? [],
    timezone: payload.timezone ?? null,
    scheduledStartUtc: payload.scheduledStartUtc ?? null,
    scheduledEndUtc: payload.scheduledEndUtc ?? null
  };
}

@Injectable()
export class MobileFieldService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GroupAccessService) private readonly groupAccess: GroupAccessService,
    @Inject(FieldBootstrapService) private readonly fieldBootstrap: FieldBootstrapService,
    @Inject(KioskPunchService) private readonly kioskPunch: KioskPunchService,
    @Inject(FieldJobService) private readonly fieldJobs: FieldJobService,
    @Inject(VehicleInspectionService) private readonly inspections: VehicleInspectionService,
    @Inject(LaborWorkAssignmentService) private readonly laborWork: LaborWorkAssignmentService,
    @Inject(VehiclePhotoService) private readonly photos: VehiclePhotoService
  ) {}

  private assertSessionScope(session: MobileSessionContext) {
    if (!session.companyId || !session.locationId || !session.employeeId) {
      throw new ForbiddenException("Mobile session is missing company, location, or employee.");
    }
  }

  private async resolveKiosk(session: MobileSessionContext) {
    this.assertSessionScope(session);
    await this.groupAccess.assertCompanyTenantOperational(session.companyId);
    return this.fieldBootstrap.resolveKioskForLocation(session.companyId, session.locationId);
  }

  async clockStatus(session: MobileSessionContext) {
    const kiosk = await this.resolveKiosk(session);
    const payload = await this.kioskPunch.lookupByEmployeeId(kiosk, session.employeeId);
    return {
      configured: true,
      ...mapFieldClockStatus(payload)
    };
  }

  async clockAction(
    session: MobileSessionContext,
    action: "clock_in" | "clock_out" | "break_start" | "break_end",
    idempotencyKey: string
  ) {
    const key = idempotencyKey?.trim() ?? "";
    if (!key) {
      throw new BadRequestException("idempotencyKey is required.");
    }

    const kiosk = await this.resolveKiosk(session);
    const payload = await this.kioskPunch.processPunchByEmployeeId(kiosk, session.employeeId, {
      action,
      idempotencyKey: key
    });

    return {
      duplicate: payload.duplicate ?? false,
      message: payload.duplicate
        ? "Duplicate request ignored."
        : `${action.replaceAll("_", " ")} accepted.`,
      configured: true,
      ...mapFieldClockStatus(payload)
    };
  }

  async jobOptions(session: MobileSessionContext) {
    this.assertSessionScope(session);
    const payload = await this.fieldJobs.getJobOptions({
      companyId: session.companyId,
      employeeId: session.employeeId
    });

    return {
      serviceClients: payload.serviceClients ?? [],
      locations: payload.locations ?? [],
      serviceCatalogItems: payload.serviceCatalogItems ?? []
    };
  }

  async jobsHistory(
    session: MobileSessionContext,
    options: { limit?: string; cursor?: string; status?: string; q?: string }
  ) {
    this.assertSessionScope(session);
    return this.fieldJobs.listJobsHistory(
      {
        companyId: session.companyId,
        employeeId: session.employeeId,
        locationId: session.locationId
      },
      options
    );
  }

  async decodeVin(session: MobileSessionContext, vin: string) {
    this.assertSessionScope(session);
    if (!vin?.trim()) {
      throw new BadRequestException("VIN is required.");
    }
    return this.fieldJobs.previewVinDecode({
      companyId: session.companyId,
      employeeId: session.employeeId,
      vin: vin.trim()
    });
  }

  async createJob(
    session: MobileSessionContext,
    input: {
      enteredVin?: string;
      serviceClientId?: string;
      locationId?: string;
      serviceCatalogItemId?: string;
      notes?: string;
    }
  ) {
    this.assertSessionScope(session);
    const enteredVin = input.enteredVin?.trim() ?? "";
    const serviceClientId = input.serviceClientId?.trim() ?? "";
    const locationId = input.locationId?.trim() ?? "";
    const serviceCatalogItemId = input.serviceCatalogItemId?.trim() ?? "";

    if (!enteredVin || !serviceClientId || !locationId || !serviceCatalogItemId) {
      throw new BadRequestException("VIN, customer, location, and service are required.");
    }

    const createInput: {
      companyId: string;
      employeeId: string;
      enteredVin: string;
      serviceClientId: string;
      locationId: string;
      serviceCatalogItemId: string;
      notes?: string;
    } = {
      companyId: session.companyId,
      employeeId: session.employeeId,
      enteredVin,
      serviceClientId,
      locationId,
      serviceCatalogItemId
    };
    const notes = input.notes?.trim();
    if (notes) {
      createInput.notes = notes;
    }

    return this.fieldJobs.createJob(createInput);
  }

  async createChecklist(session: MobileSessionContext, workOrderId: string) {
    this.assertSessionScope(session);
    const id = workOrderId?.trim() ?? "";
    if (!id) {
      throw new BadRequestException("Work order is required.");
    }
    return this.inspections.createWorkerChecklist({
      companyId: session.companyId,
      workOrderId: id
    });
  }

  async getChecklist(session: MobileSessionContext, checklistId: string) {
    this.assertSessionScope(session);
    return this.inspections.getWorkerChecklist(checklistId, session.companyId);
  }

  async patchChecklistItem(
    session: MobileSessionContext,
    checklistId: string,
    itemId: string,
    update: {
      status: ChecklistItemStatus;
      notes?: string | null;
      measurementValue?: number | null;
      measurementUnit?: string | null;
    }
  ) {
    this.assertSessionScope(session);
    return this.inspections.updateWorkerChecklistItem(checklistId, itemId, {
      companyId: session.companyId,
      ...update
    });
  }

  async completeChecklist(session: MobileSessionContext, checklistId: string) {
    this.assertSessionScope(session);
    return this.inspections.completeWorkerChecklist(checklistId, session.companyId);
  }

  async laborWorkActive(session: MobileSessionContext) {
    this.assertSessionScope(session);
    return this.laborWork.getActiveAssignment({
      companyId: session.companyId,
      employeeId: session.employeeId
    });
  }

  async laborWorkOptions(session: MobileSessionContext) {
    this.assertSessionScope(session);
    return this.laborWork.getAvailableOptions({
      companyId: session.companyId,
      employeeId: session.employeeId
    });
  }

  async laborWorkStart(
    session: MobileSessionContext,
    input: {
      serviceClientId?: string;
      locationId?: string;
      serviceCatalogItemId?: string;
      vehicleId?: string;
      vin?: string;
      notes?: string;
      workOrderId?: string;
      workOrderServiceLineId?: string;
    }
  ) {
    this.assertSessionScope(session);
    return this.laborWork.startAssignment({
      companyId: session.companyId,
      employeeId: session.employeeId,
      serviceClientId: input.serviceClientId ?? "",
      locationId: input.locationId ?? "",
      serviceCatalogItemId: input.serviceCatalogItemId ?? "",
      ...(input.vehicleId ? { vehicleId: input.vehicleId } : {}),
      ...(input.vin ? { vin: input.vin } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.workOrderId ? { workOrderId: input.workOrderId } : {}),
      ...(input.workOrderServiceLineId ? { workOrderServiceLineId: input.workOrderServiceLineId } : {})
    });
  }

  async laborWorkProgress(
    session: MobileSessionContext,
    assignmentId: string,
    body: {
      progressPercent?: number;
      referenceAction?: "prep_start" | "prep_complete" | "wash_start" | "wash_complete";
      notes?: string;
    }
  ) {
    this.assertSessionScope(session);
    return this.laborWork.updateProgress(
      assignmentId,
      { companyId: session.companyId, employeeId: session.employeeId },
      body
    );
  }

  async laborWorkComplete(session: MobileSessionContext, assignmentId: string) {
    this.assertSessionScope(session);
    return this.laborWork.completeAssignment(assignmentId, {
      companyId: session.companyId,
      employeeId: session.employeeId
    });
  }

  async laborWorkBlock(session: MobileSessionContext, assignmentId: string, blockedReason: string) {
    this.assertSessionScope(session);
    return this.laborWork.blockAssignment(
      assignmentId,
      { companyId: session.companyId, employeeId: session.employeeId },
      { blockedReason }
    );
  }

  async laborWorkCancel(session: MobileSessionContext, assignmentId: string) {
    this.assertSessionScope(session);
    return this.laborWork.cancelAssignment(assignmentId, {
      companyId: session.companyId,
      employeeId: session.employeeId
    });
  }

  async listPhotos(
    session: MobileSessionContext,
    vehicleId: string,
    opts?: { workOrderId?: string; category?: VehiclePhotoCategory }
  ) {
    this.assertSessionScope(session);
    await this.groupAccess.assertCompanyTenantOperational(session.companyId);
    return this.photos.listPhotos({
      companyId: session.companyId,
      vehicleId,
      workOrderId: opts?.workOrderId,
      category: opts?.category
    });
  }

  async uploadPhoto(
    session: MobileSessionContext,
    vehicleId: string,
    input: {
      file: { buffer: Buffer; originalname?: string; mimetype?: string };
      workOrderId?: string;
      category?: VehiclePhotoCategory;
      angle?: VehiclePhotoAngle;
      caption?: string;
    }
  ) {
    this.assertSessionScope(session);
    await this.groupAccess.assertCompanyTenantOperational(session.companyId);

    if (!input.file?.buffer?.length) {
      throw new BadRequestException("Photo file is required.");
    }
    if (!input.category) {
      throw new BadRequestException("Photo category is required.");
    }

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, companyId: session.companyId },
      select: { id: true }
    });
    if (!vehicle) {
      throw new NotFoundException("Vehicle not found.");
    }

    return this.photos.uploadPhoto({
      companyId: session.companyId,
      groupId: "",
      vehicleId,
      workOrderId: input.workOrderId,
      uploadedByEmployeeId: session.employeeId,
      category: input.category,
      angle: input.angle,
      caption: input.caption,
      originalFilename: input.file.originalname || "photo.jpg",
      buffer: input.file.buffer,
      mimeType: input.file.mimetype || "application/octet-stream"
    });
  }
}
