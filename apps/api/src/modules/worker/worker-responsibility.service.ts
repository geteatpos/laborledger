import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { WorkOrderStatus } from "@prisma/client";

import { PrismaService } from "../identity-access/prisma.service";
import { GroupAccessService } from "../identity-access/group-access.service";
import { normalizeVin, validateVin } from "../vin-decode/vin-validation";
import { VehicleInspectionService } from "../vehicle-inspection/vehicle-inspection.service";
import { resolveEmployeeByPin } from "./worker-auth.helper";

type WorkerLookupInput = {
  companyId: string;
  pin: string;
};

type WorkerScanInput = {
  companyId: string;
  pin: string;
  workOrderId: string;
  workOrderAssignmentId?: string;
  enteredVin: string;
  deviceLabel?: string;
  idempotencyKey?: string;
};

type WorkerCompleteServiceInput = {
  companyId: string;
  pin: string;
  workOrderServiceLineId: string;
  notes?: string;
};

type WorkerChecklistServiceInput = {
  companyId: string;
  pin: string;
  workOrderId: string;
  serviceCatalogItemId: string;
};

type WorkerFinalizeWorkOrderInput = {
  companyId: string;
  pin: string;
  workOrderId: string;
};

const OPEN_WORK_ORDER_STATUSES_FOR_CHECKLIST: WorkOrderStatus[] = [
  WorkOrderStatus.DRAFT,
  WorkOrderStatus.READY,
  WorkOrderStatus.ASSIGNED,
  WorkOrderStatus.IN_PROGRESS
];

@Injectable()
export class WorkerResponsibilityService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GroupAccessService) private readonly groupAccessService: GroupAccessService,
    @Inject(VehicleInspectionService)
    private readonly inspectionService: VehicleInspectionService
  ) {}

  private async assertWorkerCompanyOperational(companyId: string): Promise<void> {
    await this.groupAccessService.assertCompanyTenantOperational(companyId);
  }

  async lookup(input: WorkerLookupInput) {
    const companyId = input.companyId?.trim() ?? "";
    if (!companyId) {
      throw new BadRequestException("Company is required.");
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, groupId: true }
    });

    if (!company) {
      throw new NotFoundException("Company not found.");
    }

    await this.assertWorkerCompanyOperational(companyId);

    const employee = await resolveEmployeeByPin(this.prisma, companyId, input.pin);
    const assignments = await this.loadActiveAssignments(employee.id, companyId);

    return {
      employee: {
        id: employee.id,
        fullName: employee.fullName
      },
      company: {
        id: company.id,
        name: company.name
      },
      assignments: assignments.map((assignment) => this.mapAssignment(assignment))
    };
  }

  async scan(input: WorkerScanInput) {
    const companyId = input.companyId?.trim() ?? "";
    const workOrderId = input.workOrderId?.trim() ?? "";
    const idempotencyKey = input.idempotencyKey?.trim() || null;

    if (!companyId) {
      throw new BadRequestException("Company is required.");
    }

    if (!workOrderId) {
      throw new BadRequestException("Work order is required.");
    }

    if (idempotencyKey) {
      const existing = await this.prisma.workerScanEvent.findUnique({
        where: { idempotencyKey },
        include: {
          employee: { select: { id: true, fullName: true } },
          workOrder: { select: { workOrderNumber: true } },
          vehicle: { select: { vin: true } }
        }
      });

      if (existing) {
        return this.mapScanResponse(existing, true);
      }
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, groupId: true }
    });

    if (!company) {
      throw new NotFoundException("Company not found.");
    }

    await this.assertWorkerCompanyOperational(companyId);

    const employee = await resolveEmployeeByPin(this.prisma, companyId, input.pin);

    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId },
      include: {
        vehicle: true
      }
    });

    if (!workOrder) {
      throw new NotFoundException("Work order not found.");
    }

    if (workOrder.status === WorkOrderStatus.CANCELLED) {
      return this.recordRejectedScan({
        company,
        workOrder,
        employeeId: employee.id,
        enteredVin: input.enteredVin,
        deviceLabel: input.deviceLabel,
        idempotencyKey,
        rejectionReason: "Cancelled work orders cannot be confirmed.",
        logAction: "SCANNED"
      });
    }

    const assignmentQuery = {
      employeeId: employee.id,
      companyId,
      workOrderId,
      unassignedAt: null,
      ...(input.workOrderAssignmentId?.trim()
        ? { id: input.workOrderAssignmentId.trim() }
        : { workOrderServiceLineId: null })
    };

    const assignment = await this.prisma.workOrderAssignment.findFirst({
      where: assignmentQuery
    });

    if (!assignment) {
      return this.recordRejectedScan({
        company,
        workOrder,
        employeeId: employee.id,
        enteredVin: input.enteredVin,
        deviceLabel: input.deviceLabel,
        idempotencyKey,
        rejectionReason: "No active assignment for this work order.",
        logAction: "SCANNED"
      });
    }

    const vinValidation = validateVin(input.enteredVin);
    if ("error" in vinValidation) {
      throw new BadRequestException(vinValidation.error);
    }

    const matchedVin = vinValidation.vin === workOrder.vehicle.vin;
    const now = new Date();

    const scanEvent = await this.prisma.$transaction(async (tx) => {
      const created = await tx.workerScanEvent.create({
        data: {
          groupId: company.groupId,
          companyId,
          locationId: workOrder.locationId,
          vehicleId: workOrder.vehicleId,
          workOrderId,
          workOrderAssignmentId: assignment.id,
          employeeId: employee.id,
          enteredVin: vinValidation.vin,
          matchedVin,
          source: "manual",
          deviceLabel: this.normalizeOptionalText(input.deviceLabel),
          idempotencyKey,
          acceptedAt: matchedVin ? now : null,
          rejectedAt: matchedVin ? null : now,
          rejectionReason: matchedVin ? null : "VIN does not match assigned vehicle."
        },
        include: {
          employee: { select: { id: true, fullName: true } },
          workOrder: { select: { workOrderNumber: true } },
          vehicle: { select: { vin: true } }
        }
      });

      await tx.vehicleResponsibilityLog.create({
        data: {
          groupId: company.groupId,
          companyId,
          workOrderId,
          vehicleId: workOrder.vehicleId,
          employeeId: employee.id,
          action: matchedVin ? "RESPONSIBILITY_CONFIRMED" : "SCANNED",
          occurredAt: now,
          details: {
            source: "WORKER_MOBILE",
            scanEventId: created.id,
            assignmentId: assignment.id,
            enteredVin: vinValidation.vin,
            matchedVin,
            deviceLabel: this.normalizeOptionalText(input.deviceLabel)
          }
        }
      });

      return created;
    });

    if (!matchedVin) {
      throw new BadRequestException("VIN does not match assigned vehicle.");
    }

    return this.mapScanResponse(scanEvent, false);
  }

  async completeServiceLine(input: WorkerCompleteServiceInput) {
    const companyId = input.companyId?.trim() ?? "";
    const workOrderServiceLineId = input.workOrderServiceLineId?.trim() ?? "";

    if (!companyId) {
      throw new BadRequestException("Company is required.");
    }

    if (!workOrderServiceLineId) {
      throw new BadRequestException("Service line is required.");
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, groupId: true }
    });

    if (!company) {
      throw new NotFoundException("Company not found.");
    }

    await this.assertWorkerCompanyOperational(companyId);

    const employee = await resolveEmployeeByPin(this.prisma, companyId, input.pin);

    const serviceLine = await this.prisma.workOrderServiceLine.findFirst({
      where: { id: workOrderServiceLineId, companyId },
      include: {
        workOrder: {
          include: {
            serviceLines: { select: { id: true } }
          }
        }
      }
    });

    if (!serviceLine) {
      throw new NotFoundException("Service line not found.");
    }

    const workOrder = serviceLine.workOrder;

    if (workOrder.status === WorkOrderStatus.CANCELLED) {
      throw new BadRequestException("Cancelled work orders cannot receive service completions.");
    }

    if (workOrder.status === WorkOrderStatus.COMPLETED) {
      throw new BadRequestException("Work order is already completed.");
    }

    const existingCompletion = await this.prisma.serviceCompletion.findFirst({
      where: {
        workOrderServiceLineId,
        voidedAt: null
      }
    });

    if (existingCompletion) {
      throw new BadRequestException("Service line is already completed.");
    }

    const activeAssignments = await this.prisma.workOrderAssignment.findMany({
      where: {
        employeeId: employee.id,
        companyId,
        workOrderId: workOrder.id,
        unassignedAt: null
      }
    });

    const hasWorkOrderAssignment = activeAssignments.some(
      (assignment) => assignment.workOrderServiceLineId === null
    );
    const hasLineAssignment = activeAssignments.some(
      (assignment) => assignment.workOrderServiceLineId === workOrderServiceLineId
    );

    if (!hasWorkOrderAssignment && !hasLineAssignment) {
      throw new ForbiddenException("Employee is not assigned to this service line.");
    }

    const responsibilityScan = await this.prisma.workerScanEvent.findFirst({
      where: {
        workOrderId: workOrder.id,
        employeeId: employee.id,
        companyId,
        matchedVin: true,
        acceptedAt: { not: null }
      },
      orderBy: { acceptedAt: "desc" }
    });

    if (!responsibilityScan) {
      throw new BadRequestException("Confirm vehicle responsibility before completing services.");
    }

    await this.inspectionService.assertCanCompleteService(workOrder.id, companyId);

    const assignment =
      activeAssignments.find(
        (row) => row.workOrderServiceLineId === workOrderServiceLineId
      ) ??
      activeAssignments.find((row) => row.workOrderServiceLineId === null) ??
      null;

    const notes = this.normalizeOptionalText(input.notes);
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const completion = await tx.serviceCompletion.create({
        data: {
          groupId: company.groupId,
          companyId,
          workOrderId: workOrder.id,
          workOrderServiceLineId,
          employeeId: employee.id,
          workOrderAssignmentId: assignment?.id ?? null,
          workerScanEventId: responsibilityScan.id,
          completedBySource: "worker",
          notes,
          completedAt: now
        },
        include: {
          employee: { select: { id: true, fullName: true } },
          workOrderServiceLine: { select: { id: true, serviceNameSnapshot: true } }
        }
      });

      await tx.vehicleResponsibilityLog.create({
        data: {
          groupId: company.groupId,
          companyId,
          workOrderId: workOrder.id,
          vehicleId: workOrder.vehicleId,
          employeeId: employee.id,
          action: "SERVICE_COMPLETED",
          occurredAt: now,
          details: {
            source: "WORKER_MOBILE",
            serviceCompletionId: completion.id,
            workOrderServiceLineId,
            serviceName: serviceLine.serviceNameSnapshot,
            workerScanEventId: responsibilityScan.id
          }
        }
      });

      const completedLineCount = await tx.serviceCompletion.count({
        where: {
          workOrderId: workOrder.id,
          voidedAt: null
        }
      });

      const totalLineCount = workOrder.serviceLines.length;
      let nextStatus = workOrder.status;

      // Closure is explicit via finalizeWorkOrder — never auto-COMPLETE here.
      if (
        (workOrder.status === WorkOrderStatus.ASSIGNED ||
          workOrder.status === WorkOrderStatus.READY ||
          workOrder.status === WorkOrderStatus.DRAFT) &&
        completedLineCount >= 1
      ) {
        nextStatus = WorkOrderStatus.IN_PROGRESS;
      }

      if (nextStatus !== workOrder.status) {
        await tx.workOrder.update({
          where: { id: workOrder.id },
          data: { status: nextStatus }
        });
      }

      return {
        completion,
        workOrderStatus: nextStatus,
        completedLineCount,
        totalLineCount
      };
    });

    return {
      serviceCompletionId: result.completion.id,
      workOrderId: workOrder.id,
      workOrderServiceLineId,
      serviceName: result.completion.workOrderServiceLine.serviceNameSnapshot,
      employeeName: result.completion.employee.fullName,
      completedAt: result.completion.completedAt,
      workOrderStatus: result.workOrderStatus,
      completedLineCount: result.completedLineCount,
      totalLineCount: result.totalLineCount,
      message:
        "Service marked complete. This records responsibility for the work performed and does not replace time clock punches."
    };
  }

  /**
   * Field checklist mark: creates WorkOrderServiceLine (price snapshot server-side)
   * + ServiceCompletion. Does not expose price to the worker response.
   * Distinct from completeServiceLine (which requires a pre-existing assigned line + VIN scan).
   */
  async markWorkOrderService(input: WorkerChecklistServiceInput) {
    const { companyId, workOrderId, serviceCatalogItemId, employee, workOrder, company } =
      await this.requireOpenChecklistContext(input);

    const catalogItem = await this.prisma.serviceCatalogItem.findFirst({
      where: {
        id: serviceCatalogItemId,
        companyId,
        archivedAt: null
      }
    });

    if (!catalogItem) {
      throw new NotFoundException("Active service catalog item not found.");
    }

    const existingLine = await this.prisma.workOrderServiceLine.findFirst({
      where: {
        workOrderId,
        companyId,
        serviceCatalogItemId
      },
      include: {
        serviceCompletions: {
          where: { voidedAt: null },
          take: 1
        }
      }
    });

    if (existingLine?.serviceCompletions.length) {
      throw new BadRequestException("Service is already marked on this work order.");
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const serviceLine =
        existingLine ??
        (await tx.workOrderServiceLine.create({
          data: {
            groupId: company.groupId,
            companyId,
            workOrderId,
            serviceCatalogItemId: catalogItem.id,
            serviceNameSnapshot: catalogItem.name,
            serviceCategorySnapshot: catalogItem.category,
            unitPriceMinor: catalogItem.fixedPriceMinor,
            currencyCode: catalogItem.currencyCode,
            quantity: 1,
            lineTotalMinor: catalogItem.fixedPriceMinor
          }
        }));

      const completion = await tx.serviceCompletion.create({
        data: {
          groupId: company.groupId,
          companyId,
          workOrderId,
          workOrderServiceLineId: serviceLine.id,
          employeeId: employee.id,
          completedBySource: "field_checklist",
          completedAt: now
        },
        include: {
          employee: { select: { id: true, fullName: true } },
          workOrderServiceLine: { select: { id: true, serviceNameSnapshot: true } }
        }
      });

      const nextStatus =
        workOrder.status === WorkOrderStatus.DRAFT ||
        workOrder.status === WorkOrderStatus.READY ||
        workOrder.status === WorkOrderStatus.ASSIGNED
          ? WorkOrderStatus.IN_PROGRESS
          : workOrder.status;

      if (nextStatus !== workOrder.status || !workOrder.startedAt) {
        await tx.workOrder.update({
          where: { id: workOrderId },
          data: {
            ...(nextStatus !== workOrder.status ? { status: nextStatus } : {}),
            ...(!workOrder.startedAt ? { startedAt: now } : {})
          }
        });
      }

      return { completion, serviceLine, workOrderStatus: nextStatus };
    });

    return {
      workOrderId,
      workOrderServiceLineId: result.serviceLine.id,
      serviceCatalogItemId: catalogItem.id,
      serviceName: result.completion.workOrderServiceLine.serviceNameSnapshot,
      serviceCompletionId: result.completion.id,
      employeeName: result.completion.employee.fullName,
      completedAt: result.completion.completedAt,
      workOrderStatus: result.workOrderStatus,
      message: "Service marked complete."
    };
  }

  /**
   * Field checklist unmark: deletes ServiceCompletion and its WorkOrderServiceLine
   * while the work order is still open (not finalized).
   */
  async unmarkWorkOrderService(input: WorkerChecklistServiceInput) {
    const { companyId, workOrderId, serviceCatalogItemId } =
      await this.requireOpenChecklistContext(input);

    const serviceLine = await this.prisma.workOrderServiceLine.findFirst({
      where: {
        workOrderId,
        companyId,
        serviceCatalogItemId
      },
      include: {
        serviceCompletions: {
          where: { voidedAt: null }
        },
        assignments: {
          where: { unassignedAt: null },
          select: { id: true }
        }
      }
    });

    if (!serviceLine) {
      throw new NotFoundException("Marked service not found on this work order.");
    }

    if (serviceLine.serviceCompletions.length === 0) {
      throw new BadRequestException("Service is not marked on this work order.");
    }

    if (serviceLine.assignments.length > 0) {
      throw new BadRequestException(
        "Cannot unmark a service that still has an active assignment. Unassign first."
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.serviceCompletion.deleteMany({
        where: { workOrderServiceLineId: serviceLine.id }
      });
      await tx.workOrderServiceLine.delete({
        where: { id: serviceLine.id }
      });
    });

    return {
      workOrderId,
      serviceCatalogItemId,
      message: "Service unmarked."
    };
  }

  /**
   * Explicit finalize: requires ≥1 active ServiceCompletion, sets COMPLETED + finishedAt.
   * Finalized work orders are immutable for the field checklist.
   */
  async finalizeWorkOrder(input: WorkerFinalizeWorkOrderInput) {
    const companyId = input.companyId?.trim() ?? "";
    const workOrderId = input.workOrderId?.trim() ?? "";

    if (!companyId) {
      throw new BadRequestException("Company is required.");
    }
    if (!workOrderId) {
      throw new BadRequestException("Work order is required.");
    }

    await this.assertWorkerCompanyOperational(companyId);
    const employee = await resolveEmployeeByPin(this.prisma, companyId, input.pin);

    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId }
    });

    if (!workOrder) {
      throw new NotFoundException("Work order not found.");
    }

    if (workOrder.status === WorkOrderStatus.CANCELLED) {
      throw new BadRequestException("Cancelled work orders cannot be finalized.");
    }

    if (
      workOrder.status === WorkOrderStatus.COMPLETED ||
      workOrder.status === WorkOrderStatus.INVOICED
    ) {
      throw new BadRequestException("Work order is already finalized.");
    }

    const completionCount = await this.prisma.serviceCompletion.count({
      where: {
        workOrderId,
        companyId,
        voidedAt: null
      }
    });

    if (completionCount < 1) {
      throw new BadRequestException("At least one service must be marked before finalizing.");
    }

    const now = new Date();
    const updated = await this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: WorkOrderStatus.COMPLETED,
        finishedAt: now,
        ...(!workOrder.startedAt ? { startedAt: workOrder.createdAt } : {})
      }
    });

    const totalDurationMs =
      updated.startedAt && updated.finishedAt
        ? updated.finishedAt.getTime() - updated.startedAt.getTime()
        : null;

    return {
      workOrderId: updated.id,
      workOrderNumber: updated.workOrderNumber,
      status: updated.status,
      startedAt: updated.startedAt,
      finishedAt: updated.finishedAt,
      totalDurationMs,
      completedServiceCount: completionCount,
      finalizedByEmployeeId: employee.id,
      message: "Work order finalized."
    };
  }

  private async requireOpenChecklistContext(input: WorkerChecklistServiceInput) {
    const companyId = input.companyId?.trim() ?? "";
    const workOrderId = input.workOrderId?.trim() ?? "";
    const serviceCatalogItemId = input.serviceCatalogItemId?.trim() ?? "";

    if (!companyId) {
      throw new BadRequestException("Company is required.");
    }
    if (!workOrderId) {
      throw new BadRequestException("Work order is required.");
    }
    if (!serviceCatalogItemId) {
      throw new BadRequestException("Service is required.");
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, groupId: true }
    });

    if (!company) {
      throw new NotFoundException("Company not found.");
    }

    await this.assertWorkerCompanyOperational(companyId);
    const employee = await resolveEmployeeByPin(this.prisma, companyId, input.pin);

    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId }
    });

    if (!workOrder) {
      throw new NotFoundException("Work order not found.");
    }

    if (workOrder.status === WorkOrderStatus.CANCELLED) {
      throw new BadRequestException("Cancelled work orders cannot be updated.");
    }

    if (
      workOrder.status === WorkOrderStatus.COMPLETED ||
      workOrder.status === WorkOrderStatus.INVOICED
    ) {
      throw new BadRequestException("Finalized work orders are immutable.");
    }

    if (!OPEN_WORK_ORDER_STATUSES_FOR_CHECKLIST.includes(workOrder.status)) {
      throw new BadRequestException("Work order is not open for service checklist updates.");
    }

    return { companyId, workOrderId, serviceCatalogItemId, employee, workOrder, company };
  }

  private async loadActiveAssignments(employeeId: string, companyId: string) {
    return this.prisma.workOrderAssignment.findMany({
      where: {
        employeeId,
        companyId,
        unassignedAt: null,
        workOrder: {
          status: { notIn: [WorkOrderStatus.CANCELLED, WorkOrderStatus.COMPLETED] }
        }
      },
      include: {
        workOrderServiceLine: { select: { id: true, serviceNameSnapshot: true } },
        workOrder: {
          include: {
            serviceClient: { select: { id: true, name: true } },
            vehicle: {
              select: {
                id: true,
                vin: true,
                year: true,
                make: true,
                model: true,
                plate: true,
                color: true
              }
            },
            location: { select: { id: true, name: true } },
            serviceLines: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                serviceCatalogItemId: true,
                serviceNameSnapshot: true,
                serviceCategorySnapshot: true,
                serviceCompletions: {
                  where: { voidedAt: null },
                  orderBy: { completedAt: "desc" },
                  take: 1,
                  select: {
                    id: true,
                    completedAt: true,
                    employeeId: true,
                    employee: { select: { id: true, fullName: true } }
                  }
                }
              }
            },
            workerScanEvents: {
              where: {
                employeeId,
                matchedVin: true,
                acceptedAt: { not: null }
              },
              orderBy: { acceptedAt: "desc" },
              take: 1,
              select: {
                id: true,
                acceptedAt: true,
                enteredVin: true
              }
            }
          }
        }
      },
      orderBy: [{ assignedAt: "desc" }]
    });
  }

  private mapAssignment(
    assignment: Awaited<ReturnType<typeof this.loadActiveAssignments>>[number]
  ) {
    const lastConfirmation = assignment.workOrder.workerScanEvents[0] ?? null;
    const serviceLines = assignment.workOrder.serviceLines.map((line) => {
      const activeCompletion = line.serviceCompletions[0] ?? null;

      return {
        id: line.id,
        serviceCatalogItemId: line.serviceCatalogItemId,
        serviceNameSnapshot: line.serviceNameSnapshot,
        serviceCategorySnapshot: line.serviceCategorySnapshot,
        completion: activeCompletion
          ? {
              serviceCompletionId: activeCompletion.id,
              completedAt: activeCompletion.completedAt,
              completedByEmployeeId: activeCompletion.employeeId,
              completedByEmployeeName: activeCompletion.employee.fullName
            }
          : null
      };
    });

    return {
      assignmentId: assignment.id,
      workOrderId: assignment.workOrderId,
      workOrderServiceLineId: assignment.workOrderServiceLineId,
      workOrderNumber: assignment.workOrder.workOrderNumber,
      status: assignment.workOrder.status,
      serviceClient: assignment.workOrder.serviceClient,
      vehicle: assignment.workOrder.vehicle,
      location: assignment.workOrder.location,
      serviceLines,
      serviceLine: assignment.workOrderServiceLine,
      lastConfirmation: lastConfirmation
        ? {
            scanEventId: lastConfirmation.id,
            acceptedAt: lastConfirmation.acceptedAt,
            enteredVin: lastConfirmation.enteredVin
          }
        : null
    };
  }

  private mapScanResponse(
    scanEvent: {
      id: string;
      matchedVin: boolean;
      acceptedAt: Date | null;
      rejectedAt: Date | null;
      rejectionReason: string | null;
      enteredVin: string;
      employee: { id: string; fullName: string };
      workOrder: { workOrderNumber: string };
      vehicle: { vin: string };
    },
    duplicate: boolean
  ) {
    return {
      accepted: scanEvent.matchedVin,
      duplicate,
      scanEventId: scanEvent.id,
      workOrderNumber: scanEvent.workOrder.workOrderNumber,
      vehicleVin: scanEvent.vehicle.vin,
      enteredVin: scanEvent.enteredVin,
      employeeName: scanEvent.employee.fullName,
      acceptedAt: scanEvent.acceptedAt,
      rejectedAt: scanEvent.rejectedAt,
      rejectionReason: scanEvent.rejectionReason,
      message: scanEvent.matchedVin
        ? "Vehicle responsibility confirmed."
        : (scanEvent.rejectionReason ?? "Scan rejected.")
    };
  }

  private async recordRejectedScan(input: {
    company: { id: string; groupId: string };
    workOrder: {
      id: string;
      locationId: string;
      vehicleId: string;
      workOrderNumber: string;
      vehicle: { vin: string };
    };
    employeeId: string;
    enteredVin: string;
    deviceLabel?: string;
    idempotencyKey: string | null;
    rejectionReason: string;
    logAction: string;
  }) {
    const vinValidation = validateVin(input.enteredVin);
    const enteredVin = "error" in vinValidation ? normalizeVin(input.enteredVin) : vinValidation.vin;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const created = await tx.workerScanEvent.create({
        data: {
          groupId: input.company.groupId,
          companyId: input.company.id,
          locationId: input.workOrder.locationId,
          vehicleId: input.workOrder.vehicleId,
          workOrderId: input.workOrder.id,
          employeeId: input.employeeId,
          enteredVin: enteredVin || normalizeVin(input.enteredVin),
          matchedVin: false,
          source: "manual",
          deviceLabel: this.normalizeOptionalText(input.deviceLabel),
          idempotencyKey: input.idempotencyKey,
          rejectedAt: now,
          rejectionReason: input.rejectionReason
        }
      });

      await tx.vehicleResponsibilityLog.create({
        data: {
          groupId: input.company.groupId,
          companyId: input.company.id,
          workOrderId: input.workOrder.id,
          vehicleId: input.workOrder.vehicleId,
          employeeId: input.employeeId,
          action: input.logAction,
          occurredAt: now,
          details: {
            source: "WORKER_MOBILE",
            scanEventId: created.id,
            matchedVin: false,
            rejectionReason: input.rejectionReason,
            enteredVin: created.enteredVin
          }
        }
      });
    });

    throw new BadRequestException(input.rejectionReason);
  }

  private normalizeOptionalText(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
