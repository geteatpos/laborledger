import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { WorkOrderStatus, type Prisma } from "@prisma/client";

import { GroupAccessService } from "../identity-access/group-access.service";
import { PrismaService } from "../identity-access/prisma.service";
import { VinDecodeService } from "../vin-decode/vin-decode.service";
import { validateVin } from "../vin-decode/vin-validation";
import { resolveFieldEmployee, type FieldEmployeeAuth } from "./worker-auth.helper";
import {
  assertCatalogItemAllowed,
  assertExistingVehicleMatchesSelection,
  assertLocationAllowed,
  assertServiceClientAllowed,
  validateFieldJobCreateInput
} from "./field-job-validation";
import {
  fieldLocationOptionsSelect,
  mapFieldLocationOption
} from "../company-operations/service-client-location-access";

type FieldJobAuthInput = FieldEmployeeAuth;

type FieldJobCreateInput = FieldJobAuthInput & {
  enteredVin: string;
  serviceClientId: string;
  locationId: string;
  serviceCatalogItemId: string;
  notes?: string;
};

@Injectable()
export class FieldJobService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GroupAccessService) private readonly groupAccessService: GroupAccessService,
    @Inject(VinDecodeService) private readonly vinDecodeService: VinDecodeService
  ) {}

  async getJobOptions(input: FieldJobAuthInput) {
    const companyId = input.companyId?.trim() ?? "";
    if (!companyId) {
      throw new BadRequestException("Company is required.");
    }

    const company = await this.requireOperationalCompany(companyId);
    const employee = await resolveFieldEmployee(this.prisma, input);

    const [serviceClients, locations, serviceCatalogItems] = await Promise.all([
      this.prisma.serviceClient.findMany({
        where: { companyId, archivedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true }
      }),
      this.prisma.location.findMany({
        where: { companyId, archivedAt: null },
        orderBy: { name: "asc" },
        select: fieldLocationOptionsSelect
      }),
      this.prisma.serviceCatalogItem.findMany({
        where: { companyId, archivedAt: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, category: true }
      })
    ]);

    return {
      employee: {
        id: employee.id,
        fullName: employee.fullName
      },
      company: {
        id: company.id,
        name: company.name
      },
      serviceClients,
      locations: locations.map(mapFieldLocationOption),
      serviceCatalogItems
    };
  }

  /**
   * Creates an open field job (vehicle / work order / service line).
   * Does not mark the work order complete — completion is explicit via
   * completeServiceLine / finalizeWorkOrder (or mobile labor complete).
   */
  async createJob(input: FieldJobCreateInput) {
    const companyId = input.companyId?.trim() ?? "";
    if (!companyId) {
      throw new BadRequestException("Company is required.");
    }

    const validationError = validateFieldJobCreateInput(input);
    if (validationError) {
      throw new BadRequestException(validationError);
    }

    const company = await this.requireOperationalCompany(companyId);
    const employee = await resolveFieldEmployee(this.prisma, input);

    const vinValidation = validateVin(input.enteredVin);
    if ("error" in vinValidation) {
      throw new BadRequestException(vinValidation.error);
    }

    const serviceClientId = input.serviceClientId.trim();
    const locationId = input.locationId.trim();
    const serviceCatalogItemId = input.serviceCatalogItemId.trim();
    const notes = this.normalizeOptionalText(input.notes);

    const [serviceClient, location, catalogItem] = await Promise.all([
      this.prisma.serviceClient.findUnique({ where: { id: serviceClientId } }),
      this.prisma.location.findUnique({
        where: { id: locationId },
        include: { serviceClientLinks: { select: { serviceClientId: true } } }
      }),
      this.prisma.serviceCatalogItem.findUnique({ where: { id: serviceCatalogItemId } })
    ]);

    const serviceClientError = assertServiceClientAllowed(serviceClient, companyId);
    if (serviceClientError) {
      throw new BadRequestException(serviceClientError);
    }

    const locationError = assertLocationAllowed(
      location
        ? {
            ...location,
            linkedServiceClientIds: location.serviceClientLinks.map((link) => link.serviceClientId)
          }
        : null,
      companyId,
      serviceClientId
    );
    if (locationError) {
      throw new BadRequestException(locationError);
    }

    const catalogError = assertCatalogItemAllowed(catalogItem, companyId);
    if (catalogError) {
      throw new BadRequestException(catalogError);
    }

    const existingVehicle = await this.prisma.vehicle.findFirst({
      where: { companyId, vin: vinValidation.vin }
    });

    const vehicleMismatchError = assertExistingVehicleMatchesSelection({
      vehicle: existingVehicle,
      serviceClientId,
      locationId
    });
    if (vehicleMismatchError) {
      throw new BadRequestException(vehicleMismatchError);
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const vehicle =
        existingVehicle && !existingVehicle.archivedAt
          ? existingVehicle
          : await this.createVehicleForFieldJob(tx, {
              company,
              vin: vinValidation.vin,
              serviceClientId,
              locationId
            });

      const workOrderNumber = await this.generateWorkOrderNumber(tx, companyId);
      const workOrder = await tx.workOrder.create({
        data: {
          groupId: company.groupId,
          companyId,
          serviceClientId,
          locationId,
          vehicleId: vehicle.id,
          workOrderNumber,
          status: WorkOrderStatus.IN_PROGRESS,
          notes,
          startedAt: now
        }
      });

      const serviceLine = await tx.workOrderServiceLine.create({
        data: {
          groupId: company.groupId,
          companyId,
          workOrderId: workOrder.id,
          serviceCatalogItemId: catalogItem!.id,
          serviceNameSnapshot: catalogItem!.name,
          serviceCategorySnapshot: catalogItem!.category,
          unitPriceMinor: catalogItem!.fixedPriceMinor,
          currencyCode: catalogItem!.currencyCode,
          quantity: 1,
          lineTotalMinor: catalogItem!.fixedPriceMinor
        }
      });

      const assignment = await tx.workOrderAssignment.create({
        data: {
          groupId: company.groupId,
          companyId,
          workOrderId: workOrder.id,
          workOrderServiceLineId: serviceLine.id,
          employeeId: employee.id,
          roleLabel: "Field technician"
        }
      });

      const scanEvent = await tx.workerScanEvent.create({
        data: {
          groupId: company.groupId,
          companyId,
          locationId,
          vehicleId: vehicle.id,
          workOrderId: workOrder.id,
          workOrderAssignmentId: assignment.id,
          employeeId: employee.id,
          enteredVin: vinValidation.vin,
          matchedVin: true,
          source: "field_create",
          acceptedAt: now
        }
      });

      await tx.vehicleResponsibilityLog.create({
        data: {
          groupId: company.groupId,
          companyId,
          workOrderId: workOrder.id,
          vehicleId: vehicle.id,
          employeeId: employee.id,
          action: "RESPONSIBILITY_CONFIRMED",
          occurredAt: now,
          details: {
            source: "FIELD_CREATE",
            scanEventId: scanEvent.id,
            assignmentId: assignment.id,
            enteredVin: vinValidation.vin,
            matchedVin: true
          }
        }
      });

      return {
        workOrder,
        serviceLine,
        vehicle,
        serviceClient: serviceClient!,
        location: location!
      };
    });

    return {
      jobId: result.workOrder.id,
      assignmentId: result.workOrder.id,
      workOrderId: result.workOrder.id,
      workOrderNumber: result.workOrder.workOrderNumber,
      workOrderServiceLineId: result.serviceLine.id,
      serviceName: result.serviceLine.serviceNameSnapshot,
      serviceClientName: result.serviceClient.name,
      locationName: result.location.name,
      vehicleId: result.vehicle.id,
      vehicleVin: result.vehicle.vin,
      vehicleTitle: [result.vehicle.year, result.vehicle.make, result.vehicle.model]
        .filter(Boolean)
        .join(" "),
      notes,
      completedAt: null,
      message: "Job created"
    };
  }

  /** @deprecated Use createJob — create no longer marks the work order complete. */
  async createAndCompleteJob(input: FieldJobCreateInput) {
    return this.createJob(input);
  }

  async previewVinDecode(input: FieldEmployeeAuth & { vin: string }) {
    const companyId = input.companyId?.trim() ?? "";
    const vin = input.vin?.trim() ?? "";
    if (!companyId) {
      throw new BadRequestException("Company is required.");
    }
    if (!vin) {
      throw new BadRequestException("VIN is required.");
    }

    await this.requireOperationalCompany(companyId);
    await resolveFieldEmployee(this.prisma, input);

    const vinValidation = validateVin(vin);
    if ("error" in vinValidation) {
      throw new BadRequestException(vinValidation.error);
    }

    return this.vinDecodeService.previewVin(vinValidation.vin);
  }

  async listRecentCompletions(input: FieldJobAuthInput, limit = 10) {
    const companyId = input.companyId?.trim() ?? "";
    if (!companyId) {
      throw new BadRequestException("Company is required.");
    }

    await this.requireOperationalCompany(companyId);
    const employee = await resolveFieldEmployee(this.prisma, input);

    const completions = await this.prisma.serviceCompletion.findMany({
      where: {
        companyId,
        employeeId: employee.id,
        voidedAt: null
      },
      include: {
        workOrderServiceLine: { select: { serviceNameSnapshot: true } },
        workOrder: {
          include: {
            vehicle: { select: { vin: true, year: true, make: true, model: true } },
            serviceClient: { select: { name: true } },
            location: { select: { name: true } }
          }
        }
      },
      orderBy: { completedAt: "desc" },
      take: Math.min(Math.max(limit, 1), 25)
    });

    return {
      completions: completions.map((completion) => ({
        serviceCompletionId: completion.id,
        completedAt: completion.completedAt,
        serviceName: completion.workOrderServiceLine.serviceNameSnapshot,
        workOrderNumber: completion.workOrder.workOrderNumber,
        customerName: completion.workOrder.serviceClient.name,
        locationName: completion.workOrder.location.name,
        vehicleVin: completion.workOrder.vehicle.vin,
        notes: completion.notes
      }))
    };
  }

  private async requireOperationalCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, groupId: true }
    });

    if (!company) {
      throw new NotFoundException("Company not found.");
    }

    await this.groupAccessService.assertCompanyTenantOperational(companyId);
    return company;
  }

  private async createVehicleForFieldJob(
    tx: Prisma.TransactionClient,
    input: {
      company: { id: string; groupId: string };
      vin: string;
      serviceClientId: string;
      locationId: string;
    }
  ) {
    const decode = await this.vinDecodeService.decodeVin(input.vin);

    return tx.vehicle.create({
      data: {
        groupId: input.company.groupId,
        companyId: input.company.id,
        serviceClientId: input.serviceClientId,
        locationId: input.locationId,
        vin: input.vin,
        year: decode.year,
        make: decode.make,
        model: decode.model,
        trim: decode.trim,
        bodyClass: decode.bodyClass,
        vehicleType: decode.vehicleType,
        fuelType: decode.fuelType,
        decodedAt: new Date(decode.decodedAt),
        decodeSource: decode.source,
        decodePayload: decode.rawPayload
      }
    });
  }

  private async generateWorkOrderNumber(tx: Prisma.TransactionClient, companyId: string) {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const prefix = `WO-${datePart}-`;
    const count = await tx.workOrder.count({
      where: {
        companyId,
        workOrderNumber: { startsWith: prefix }
      }
    });

    return `${prefix}${String(count + 1).padStart(4, "0")}`;
  }

  private normalizeOptionalText(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
