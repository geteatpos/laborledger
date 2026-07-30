import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from "@nestjs/common";
import {
  MechanicOrderApprovalStatus,
  Prisma,
  type MechanicOrderPart,
  type WorkOrder
} from "@prisma/client";

import { CompanyScopeService } from "../identity-access/company-scope.service";
import type { AuthenticatedPrincipal } from "../identity-access/auth.types";
import { GroupAccessService } from "../identity-access/group-access.service";
import { PrismaService } from "../identity-access/prisma.service";

export type MechanicOrderPartInput = {
  name?: string | undefined;
  quantity?: number | undefined;
  notes?: string | null | undefined;
  photoId?: string | null | undefined;
};

export type MechanicOrderNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  referenceId: string | null;
  readAt: string | null;
  createdAt: string;
};

@Injectable()
export class MechanicOrderService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanyScopeService)
    private readonly companyScopeService: CompanyScopeService,
    @Inject(GroupAccessService)
    private readonly groupAccessService: GroupAccessService
  ) {}

  async createMechanicOrder(opts: {
    companyId: string;
    workOrderId: string;
  }) {
    const workOrder = await this.requireWorkOrder(opts.companyId, opts.workOrderId);

    const existingApproval = await this.prisma.mechanicOrderApproval.findUnique({
      where: { workOrderId: workOrder.id }
    });

    if (existingApproval) {
      if (
        existingApproval.status === MechanicOrderApprovalStatus.PENDING ||
        workOrder.status === "PENDING_MECHANIC_APPROVAL"
      ) {
        throw new ConflictException("Work order is already a mechanic order awaiting approval.");
      }
      if (existingApproval.status === MechanicOrderApprovalStatus.REJECTED) {
        throw new ConflictException(
          "This work order was rejected as a mechanic order and cannot be reopened here."
        );
      }
    }

    if (
      workOrder.status === "PENDING_MECHANIC_APPROVAL" ||
      workOrder.status === "MECHANIC_REJECTED"
    ) {
      throw new ConflictException(
        `Work order already in mechanic flow (status=${workOrder.status}).`
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedWorkOrder = await tx.workOrder.update({
        where: { id: workOrder.id },
        data: { status: "PENDING_MECHANIC_APPROVAL" }
      });

      await tx.mechanicOrderApproval.create({
        data: {
          groupId: workOrder.groupId,
          companyId: workOrder.companyId,
          workOrderId: workOrder.id,
          status: "PENDING"
        }
      });

      return updatedWorkOrder;
    });

    return this.getMechanicOrder(updated.id, opts.companyId);
  }

  async addPart(opts: {
    companyId: string;
    workOrderId: string;
    name?: string | undefined;
    quantity?: number | undefined;
    notes?: string | null | undefined;
    photoId?: string | null | undefined;
  }): Promise<MechanicOrderPart> {
    const workOrder = await this.requirePendingMechanicOrder(opts.companyId, opts.workOrderId);

    const name = opts.name?.trim();
    if (!name) {
      throw new BadRequestException("Part name is required.");
    }

    if (opts.photoId) {
      const photo = await this.prisma.vehiclePhoto.findFirst({
        where: { id: opts.photoId, companyId: opts.companyId, deletedAt: null }
      });
      if (!photo) {
        throw new NotFoundException("Photo not found for this company.");
      }
    }

    const last = await this.prisma.mechanicOrderPart.findFirst({
      where: { workOrderId: workOrder.id },
      orderBy: { positionOrder: "desc" },
      select: { positionOrder: true }
    });

    return this.prisma.mechanicOrderPart.create({
      data: {
        groupId: workOrder.groupId,
        companyId: workOrder.companyId,
        workOrderId: workOrder.id,
        name,
        quantity: opts.quantity ?? 1,
        notes: opts.notes ?? null,
        photoId: opts.photoId ?? null,
        positionOrder: (last?.positionOrder ?? -1) + 1
      }
    });
  }

  async updatePart(
    partId: string,
    companyId: string,
    dto: MechanicOrderPartInput
  ): Promise<MechanicOrderPart> {
    const part = await this.prisma.mechanicOrderPart.findFirst({
      where: { id: partId, companyId }
    });
    if (!part) {
      throw new NotFoundException("Part not found.");
    }

    await this.assertPendingMechanicOrder(companyId, part.workOrderId);

    if (dto.photoId !== undefined && dto.photoId !== null) {
      const photo = await this.prisma.vehiclePhoto.findFirst({
        where: { id: dto.photoId, companyId, deletedAt: null }
      });
      if (!photo) {
        throw new NotFoundException("Photo not found for this company.");
      }
    }

    const data: {
      name?: string;
      quantity?: number;
      notes?: string | null;
      photoId?: string | null;
    } = {};
    if (dto.name !== undefined) {
      const trimmed = dto.name.trim();
      if (trimmed) data.name = trimmed;
    }
    if (dto.quantity !== undefined) data.quantity = dto.quantity;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.photoId !== undefined) data.photoId = dto.photoId;

    return this.prisma.mechanicOrderPart.update({
      where: { id: part.id },
      data
    });
  }

  async deletePart(partId: string, companyId: string): Promise<{ id: string }> {
    const part = await this.prisma.mechanicOrderPart.findFirst({
      where: { id: partId, companyId }
    });
    if (!part) {
      throw new NotFoundException("Part not found.");
    }

    await this.assertPendingMechanicOrder(companyId, part.workOrderId);

    await this.prisma.mechanicOrderPart.delete({ where: { id: part.id } });
    return { id: part.id };
  }

  async getMechanicOrder(workOrderId: string, companyId: string) {
    const workOrder = await this.requireWorkOrder(companyId, workOrderId);

    return this.prisma.workOrder.findUnique({
      where: { id: workOrder.id },
      include: {
        vehicle: true,
        mechanicParts: {
          orderBy: { positionOrder: "asc" },
          include: {
            photo: true
          }
        },
        mechanicApproval: {
          include: {
            supervisor: {
              select: { id: true, fullName: true, email: true }
            }
          }
        },
        assignments: {
          orderBy: { assignedAt: "asc" },
          include: {
            employee: { select: { id: true, fullName: true } }
          }
        }
      }
    });
  }

  async listMechanicOrders(
    companyId: string,
    principal: AuthenticatedPrincipal,
    statusFilter: "PENDING" | "APPROVED" | "REJECTED" | "ALL" = "PENDING"
  ) {
    await this.groupAccessService.assertCompanyTenantOperational(companyId);

    const context = await this.companyScopeService.getCompanyAccessContext(principal, companyId);
    const where: Prisma.WorkOrderWhereInput = {
      companyId,
      mechanicApproval: { isNot: null }
    };

    if (statusFilter === "PENDING") {
      where.status = "PENDING_MECHANIC_APPROVAL";
    } else if (statusFilter === "APPROVED") {
      where.mechanicApproval = { is: { status: "APPROVED" } };
    } else if (statusFilter === "REJECTED") {
      where.status = "MECHANIC_REJECTED";
    }

    if (!context.unrestrictedLocations && context.allowedLocationIds.length > 0) {
      where.locationId = { in: context.allowedLocationIds };
    } else if (!context.unrestrictedLocations && context.accessLevel === "supervisor") {
      where.id = "__never__";
    }

    return this.prisma.workOrder.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        vehicle: true,
        mechanicParts: { select: { id: true } },
        mechanicApproval: {
          include: {
            supervisor: { select: { id: true, fullName: true } }
          }
        }
      }
    });
  }

  /** @deprecated Prefer listMechanicOrders — kept for call-site clarity during transition. */
  async listPendingMechanicOrders(companyId: string, principal: AuthenticatedPrincipal) {
    return this.listMechanicOrders(companyId, principal, "PENDING");
  }

  async approveOrder(opts: {
    companyId: string;
    workOrderId: string;
    supervisorUserId: string;
    note?: string | undefined;
    contactMethod?: string | undefined;
  }) {
    return this.decide(opts, "APPROVED", "ASSIGNED", "mechanic_approved", (wo) =>
      `Your mechanic order for ${wo.vehicle.year ?? ""} ${wo.vehicle.make ?? ""} ${wo.vehicle.model ?? ""} has been approved`.trim()
    );
  }

  async rejectOrder(opts: {
    companyId: string;
    workOrderId: string;
    supervisorUserId: string;
    note: string;
    contactMethod?: string | undefined;
  }) {
    if (!opts.note?.trim()) {
      throw new BadRequestException("Rejection note is required.");
    }
    return this.decide(opts, "REJECTED", "MECHANIC_REJECTED", "mechanic_rejected", (wo) =>
      `Your mechanic order for ${wo.vehicle.year ?? ""} ${wo.vehicle.make ?? ""} ${wo.vehicle.model ?? ""} has been rejected`.trim()
    );
  }

  async getNotificationsForEmployee(opts: {
    companyId: string;
    employeeId: string;
  }): Promise<MechanicOrderNotification[]> {
    await this.groupAccessService.assertCompanyTenantOperational(opts.companyId);
    const notifications = await this.prisma.inAppNotification.findMany({
      where: {
        companyId: opts.companyId,
        recipientId: opts.employeeId,
        recipientType: "employee"
      },
      orderBy: { createdAt: "desc" },
      take: 20
    });

    return notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      referenceId: n.referenceId,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString()
    }));
  }

  async markNotificationRead(opts: {
    companyId: string;
    notificationId: string;
    employeeId: string;
  }) {
    const notification = await this.prisma.inAppNotification.findFirst({
      where: {
        id: opts.notificationId,
        companyId: opts.companyId,
        recipientId: opts.employeeId,
        recipientType: "employee"
      }
    });

    if (!notification) {
      throw new NotFoundException("Notification not found.");
    }

    if (notification.readAt) {
      return { id: notification.id, readAt: notification.readAt.toISOString() };
    }

    const updated = await this.prisma.inAppNotification.update({
      where: { id: notification.id },
      data: { readAt: new Date() }
    });

    return { id: updated.id, readAt: updated.readAt!.toISOString() };
  }

  private async decide(
    opts: {
      companyId: string;
      workOrderId: string;
      supervisorUserId: string;
      note?: string | undefined;
      contactMethod?: string | undefined;
    },
    approvalStatus: MechanicOrderApprovalStatus,
    nextWorkOrderStatus: "ASSIGNED" | "MECHANIC_REJECTED",
    notificationType: string,
    notificationBodyBuilder: (wo: {
      vehicle: { year: number | null; make: string | null; model: string | null };
    }) => string
  ) {
    const workOrder = await this.requireWorkOrder(opts.companyId, opts.workOrderId);

    if (workOrder.status !== "PENDING_MECHANIC_APPROVAL") {
      throw new UnprocessableEntityException(
        `Work order is not awaiting mechanic approval (status=${workOrder.status}).`
      );
    }

    const approval = await this.prisma.mechanicOrderApproval.findUnique({
      where: { workOrderId: workOrder.id }
    });
    if (!approval) {
      throw new NotFoundException("Mechanic approval record not found for this work order.");
    }

    const activeAssignment = await this.prisma.workOrderAssignment.findFirst({
      where: { workOrderId: workOrder.id, unassignedAt: null },
      orderBy: { assignedAt: "desc" },
      select: { employeeId: true }
    });

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.workOrderStatusHistory.create({
        data: {
          groupId: workOrder.groupId,
          companyId: workOrder.companyId,
          workOrderId: workOrder.id,
          fromStatus: workOrder.status,
          toStatus: nextWorkOrderStatus,
          reason: approvalStatus === "APPROVED" ? "Mechanic order approved" : "Mechanic order rejected",
          createdByUserId: opts.supervisorUserId
        },
        select: { id: true }
      });

      const updatedWorkOrder = await tx.workOrder.update({
        where: { id: workOrder.id },
        data: { status: nextWorkOrderStatus }
      });

      const updatedApproval = await tx.mechanicOrderApproval.update({
        where: { id: approval.id },
        data: {
          status: approvalStatus,
          supervisorId: opts.supervisorUserId,
          note: opts.note?.trim() ? opts.note.trim() : null,
          contactMethod: opts.contactMethod?.trim() ? opts.contactMethod.trim() : null,
          decidedAt: new Date()
        }
      });

      if (activeAssignment) {
        const woWithVehicle = await tx.workOrder.findUnique({
          where: { id: workOrder.id },
          select: {
            groupId: true,
            companyId: true,
            vehicle: { select: { year: true, make: true, model: true } }
          }
        });

        if (woWithVehicle) {
          await tx.inAppNotification.create({
            data: {
              groupId: woWithVehicle.groupId,
              companyId: woWithVehicle.companyId,
              recipientId: activeAssignment.employeeId,
              recipientType: "employee",
              type: notificationType,
              title: approvalStatus === "APPROVED" ? "Work order approved" : "Work order rejected",
              body: notificationBodyBuilder(woWithVehicle),
              referenceId: workOrder.id
            }
          });
        }
      }

      void updatedApproval;
      return { workOrder: updatedWorkOrder };
    });

    return this.getMechanicOrder(result.workOrder.id, opts.companyId);
  }

  private async requireWorkOrder(companyId: string, workOrderId: string) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId }
    });
    if (!workOrder) {
      throw new NotFoundException("Work order not found for this company.");
    }
    return workOrder;
  }

  private async requirePendingMechanicOrder(companyId: string, workOrderId: string): Promise<WorkOrder> {
    const workOrder = await this.requireWorkOrder(companyId, workOrderId);
    if (workOrder.status !== "PENDING_MECHANIC_APPROVAL") {
      throw new ConflictException(
        `Work order is not awaiting mechanic parts (status=${workOrder.status}).`
      );
    }
    return workOrder;
  }

  private async assertPendingMechanicOrder(companyId: string, workOrderId: string): Promise<void> {
    await this.requirePendingMechanicOrder(companyId, workOrderId);
  }
}
