import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from "@nestjs/common";
import { Prisma, type ChecklistItemStatus } from "@prisma/client";

import { PrismaService } from "../identity-access/prisma.service";
import { CompanyScopeService } from "../identity-access/company-scope.service";
import type { AuthenticatedPrincipal } from "../identity-access/auth.types";
import { CHECKLIST_CATALOG } from "./checklist-catalog";

export type WorkerChecklistCreateInput = {
  companyId: string;
  workOrderId: string;
};

export type WorkerChecklistItemUpdateInput = {
  companyId: string;
  status: ChecklistItemStatus;
  notes?: string | null | undefined;
  measurementValue?: number | null | undefined;
  measurementUnit?: string | null | undefined;
};

export type AdminChecklistListInput = {
  companyId: string;
  offset?: number | undefined;
  limit?: number | undefined;
};

const RAW_SUPERVISOR_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 50;

@Injectable()
export class VehicleInspectionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanyScopeService)
    private readonly companyScopeService: CompanyScopeService
  ) {}

  async createWorkerChecklist(input: WorkerChecklistCreateInput) {
    const companyId = input.companyId?.trim() ?? "";
    if (!companyId) {
      throw new NotFoundException("Work order not found.");
    }

    const workOrderId = input.workOrderId?.trim() ?? "";
    if (!workOrderId) {
      throw new NotFoundException("Work order not found.");
    }

    const existing = await this.prisma.vehicleInspectionChecklist.findUnique({
      where: { workOrderId },
      select: { id: true, companyId: true }
    });

    if (existing) {
      if (existing.companyId !== companyId) {
        throw new ForbiddenException("Checklist does not belong to this company.");
      }
      throw new ConflictException("Checklist already exists for this work order.");
    }

    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId },
      select: {
        id: true,
        groupId: true,
        companyId: true,
        vehicleId: true
      }
    });

    if (!workOrder) {
      throw new NotFoundException("Work order not found.");
    }

    const employee = await this.prisma.employee.findFirst({
      where: { archivedAt: null, companyId },
      orderBy: { createdAt: "asc" },
      select: { id: true }
    });

    if (!employee) {
      throw new NotFoundException("No active employees available for this company.");
    }

    const checklist = await this.prisma.$transaction(async (tx) => {
      const created = await tx.vehicleInspectionChecklist.create({
        data: {
          groupId: workOrder.groupId,
          companyId,
          vehicleId: workOrder.vehicleId,
          workOrderId: workOrder.id,
          employeeId: employee.id
        }
      });

      await tx.vehicleInspectionChecklistItem.createMany({
        data: CHECKLIST_CATALOG.map((entry) => ({
          checklistId: created.id,
          key: entry.key,
          labelSnapshot: entry.label,
          category: entry.category,
          positionOrder: entry.positionOrder
        }))
      });

      return tx.vehicleInspectionChecklist.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          items: {
            orderBy: { positionOrder: "asc" }
          }
        }
      });
    });

    return this.mapChecklistDetail(checklist);
  }

  async getWorkerChecklist(checklistId: string, companyId: string) {
    const checklist = await this.prisma.vehicleInspectionChecklist.findFirst({
      where: { id: checklistId, companyId },
      include: {
        items: {
          orderBy: { positionOrder: "asc" }
        }
      }
    });

    if (!checklist) {
      throw new NotFoundException("Checklist not found.");
    }

    return this.mapChecklistDetail(checklist);
  }

  async updateWorkerChecklistItem(
    checklistId: string,
    itemId: string,
    input: WorkerChecklistItemUpdateInput
  ) {
    const companyId = input.companyId?.trim() ?? "";

    const checklist = await this.prisma.vehicleInspectionChecklist.findFirst({
      where: { id: checklistId, companyId },
      select: { id: true, status: true }
    });

    if (!checklist) {
      throw new NotFoundException("Checklist not found.");
    }

    if (checklist.status !== "IN_PROGRESS") {
      throw new UnprocessableEntityException(
        "Checklist is no longer in progress and cannot be edited."
      );
    }

    const item = await this.prisma.vehicleInspectionChecklistItem.findFirst({
      where: { id: itemId, checklistId: checklist.id }
    });

    if (!item) {
      throw new NotFoundException("Checklist item not found.");
    }

    const data: Prisma.VehicleInspectionChecklistItemUpdateInput = {};

    if (input.status !== undefined) {
      data.status = input.status;
    }
    if (input.notes !== undefined) {
      data.notes = this.normalizeOptionalText(input.notes);
    }
    if (input.measurementValue !== undefined) {
      data.measurementValue =
        input.measurementValue === null ? null : input.measurementValue;
    }
    if (input.measurementUnit !== undefined) {
      data.measurementUnit =
        input.measurementUnit === null ? null : input.measurementUnit.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      return this.getWorkerChecklist(checklistId, companyId);
    }

    await this.prisma.vehicleInspectionChecklistItem.update({
      where: { id: item.id },
      data
    });

    return this.getWorkerChecklist(checklistId, companyId);
  }

  async completeWorkerChecklist(checklistId: string, companyId: string) {
    const checklist = await this.prisma.vehicleInspectionChecklist.findFirst({
      where: { id: checklistId, companyId },
      include: {
        items: {
          orderBy: { positionOrder: "asc" }
        }
      }
    });

    if (!checklist) {
      throw new NotFoundException("Checklist not found.");
    }

    if (checklist.status !== "IN_PROGRESS") {
      throw new UnprocessableEntityException(
        "Checklist is no longer in progress."
      );
    }

    const pending = checklist.items.filter((item) => item.status === "NA");
    if (pending.length > 0) {
      throw new UnprocessableEntityException(
        `Cannot complete checklist while items are still N/A: ${pending.map((item) => item.key).join(", ")}`
      );
    }

    const updated = await this.prisma.vehicleInspectionChecklist.update({
      where: { id: checklist.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date()
      },
      include: {
        items: {
          orderBy: { positionOrder: "asc" }
        }
      }
    });

    return this.mapChecklistDetail(updated);
  }

  async listAdminChecklists(
    principal: AuthenticatedPrincipal,
    input: AdminChecklistListInput
  ) {
    const context = await this.companyScopeService.getCompanyAccessContext(
      principal,
      input.companyId
    );

    const offset = Math.max(input.offset ?? 0, 0);
    const limit = Math.min(
      Math.max(input.limit ?? RAW_SUPERVISOR_PAGE_LIMIT, 1),
      MAX_PAGE_LIMIT
    );

    const where: Prisma.VehicleInspectionChecklistWhereInput = {
      companyId: input.companyId
    };

    if (!context.unrestrictedLocations && context.allowedLocationIds.length > 0) {
      where.workOrder = {
        locationId: { in: context.allowedLocationIds }
      };
    } else if (!context.unrestrictedLocations) {
      return {
        checklists: [],
        total: 0,
        offset,
        limit
      };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vehicleInspectionChecklist.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        include: {
          vehicle: {
            select: { id: true, vin: true, make: true, model: true, year: true }
          },
          workOrder: {
            select: {
              id: true,
              workOrderNumber: true,
              status: true,
              locationId: true
            }
          },
          employee: {
            select: { id: true, fullName: true }
          }
        }
      }),
      this.prisma.vehicleInspectionChecklist.count({ where })
    ]);

    return {
      checklists: items.map((item) => this.mapChecklistSummary(item)),
      total,
      offset,
      limit
    };
  }

  async getAdminChecklist(
    principal: AuthenticatedPrincipal,
    companyId: string,
    checklistId: string
  ) {
    const context = await this.companyScopeService.getCompanyAccessContext(
      principal,
      companyId
    );

    const checklist = await this.prisma.vehicleInspectionChecklist.findFirst({
      where: { id: checklistId, companyId },
      include: {
        items: {
          orderBy: { positionOrder: "asc" }
        },
        vehicle: {
          select: { id: true, vin: true, make: true, model: true, year: true }
        },
        workOrder: {
          select: {
            id: true,
            workOrderNumber: true,
            status: true,
            locationId: true
          }
        },
        employee: {
          select: { id: true, fullName: true }
        }
      }
    });

    if (!checklist) {
      throw new NotFoundException("Checklist not found.");
    }

    if (!context.unrestrictedLocations && !context.allowedLocationIds.includes(checklist.workOrder.locationId)) {
      throw new ForbiddenException("Location access denied.");
    }

    return this.mapChecklistDetail(checklist);
  }

  async getAdminChecklistByWorkOrder(
    principal: AuthenticatedPrincipal,
    workOrderId: string
  ) {
    const workOrder = await this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: { id: true, companyId: true, locationId: true }
    });

    if (!workOrder) {
      throw new NotFoundException("Checklist not found.");
    }

    const context = await this.companyScopeService.getCompanyAccessContext(
      principal,
      workOrder.companyId
    );

    if (
      !context.unrestrictedLocations &&
      !context.allowedLocationIds.includes(workOrder.locationId)
    ) {
      throw new ForbiddenException("Location access denied.");
    }

    const checklist = await this.prisma.vehicleInspectionChecklist.findFirst({
      where: { workOrderId, companyId: workOrder.companyId },
      include: {
        items: {
          orderBy: { positionOrder: "asc" }
        },
        vehicle: {
          select: { id: true, vin: true, make: true, model: true, year: true }
        },
        workOrder: {
          select: {
            id: true,
            workOrderNumber: true,
            status: true,
            locationId: true
          }
        },
        employee: {
          select: { id: true, fullName: true }
        }
      }
    });

    if (!checklist) {
      throw new NotFoundException("Checklist not found.");
    }

    return this.mapChecklistDetail(checklist);
  }

  async assertCanCompleteService(workOrderId: string, companyId: string) {
    const checklist = await this.prisma.vehicleInspectionChecklist.findUnique({
      where: { workOrderId },
      select: { status: true, companyId: true }
    });

    if (!checklist) {
      return;
    }

    if (checklist.companyId !== companyId) {
      throw new ForbiddenException("Checklist does not belong to this company.");
    }

    if (checklist.status === "IN_PROGRESS") {
      throw new UnprocessableEntityException(
        "Cannot complete service: vehicle inspection checklist is still in progress"
      );
    }
  }

  private mapChecklistDetail(
    checklist: Prisma.VehicleInspectionChecklistGetPayload<{
      include: { items: true };
    }>
  ): ReturnType<typeof this.serializeChecklistDetail>;
  private mapChecklistDetail(
    checklist: Prisma.VehicleInspectionChecklistGetPayload<{
      include: { items: true; vehicle: true; workOrder: true; employee: true };
    }>
  ): ReturnType<typeof this.serializeChecklistDetail>;
  private mapChecklistDetail(checklist: {
    id: string;
    workOrderId: string;
    vehicleId: string;
    employeeId: string;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    items: Array<{
      id: string;
      key: string;
      labelSnapshot: string;
      category: string;
      positionOrder: number;
      status: ChecklistItemStatus;
      notes: string | null;
      measurementValue: number | null;
      measurementUnit: string | null;
      updatedAt: Date;
    }>;
  }) {
    return this.serializeChecklistDetail(checklist);
  }

  private serializeChecklistDetail(checklist: {
    id: string;
    workOrderId: string;
    vehicleId: string;
    employeeId: string;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    items: Array<{
      id: string;
      key: string;
      labelSnapshot: string;
      category: string;
      positionOrder: number;
      status: ChecklistItemStatus;
      notes: string | null;
      measurementValue: number | null;
      measurementUnit: string | null;
      updatedAt: Date;
    }>;
  }) {
    return {
      id: checklist.id,
      workOrderId: checklist.workOrderId,
      vehicleId: checklist.vehicleId,
      employeeId: checklist.employeeId,
      status: checklist.status,
      startedAt: checklist.startedAt,
      completedAt: checklist.completedAt,
      createdAt: checklist.createdAt,
      updatedAt: checklist.updatedAt,
      items: (checklist.items ?? []).map((item) => ({
        id: item.id,
        key: item.key,
        label: item.labelSnapshot,
        category: item.category,
        positionOrder: item.positionOrder,
        status: item.status,
        notes: item.notes,
        measurementValue: item.measurementValue,
        measurementUnit: item.measurementUnit,
        updatedAt: item.updatedAt
      }))
    };
  }

  private mapChecklistSummary(checklist: {
    id: string;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    createdAt: Date;
    vehicle: { id: string; vin: string; make: string | null; model: string | null; year: number | null };
    workOrder: { id: string; workOrderNumber: string; status: string; locationId: string };
    employee: { id: string; fullName: string };
  }) {
    return {
      id: checklist.id,
      status: checklist.status,
      startedAt: checklist.startedAt,
      completedAt: checklist.completedAt,
      createdAt: checklist.createdAt,
      vehicle: {
        id: checklist.vehicle.id,
        vin: checklist.vehicle.vin,
        make: checklist.vehicle.make,
        model: checklist.vehicle.model,
        year: checklist.vehicle.year
      },
      workOrder: {
        id: checklist.workOrder.id,
        workOrderNumber: checklist.workOrder.workOrderNumber,
        status: checklist.workOrder.status,
        locationId: checklist.workOrder.locationId
      },
      employee: {
        id: checklist.employee.id,
        fullName: checklist.employee.fullName
      }
    };
  }

  private normalizeOptionalText(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
