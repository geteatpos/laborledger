import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import * as argon2 from "argon2";
import {
  CompanyRole,
  ClientInvoiceStatus,
  MembershipStatus,
  Prisma,
  ShiftBatchType,
  ShiftStatus,
  WorkOrderStatus
} from "@prisma/client";

import type { AuthenticatedPrincipal } from "../identity-access/auth.types";
import {
  CompanyScopeService,
  type CompanyAccessContext
} from "../identity-access/company-scope.service";
import { PrismaService } from "../identity-access/prisma.service";
import { VinDecodeService } from "../vin-decode/vin-decode.service";
import { WeeklyPeriodLockService } from "../weekly-close/weekly-period-lock.service";
import { resolveCompanyCloseTimeZone, weekRangeToUtcBounds, DEFAULT_TIMEZONE } from "../weekly-close/week-period";
import {
  assertShiftMutableForScheduling,
  buildCopyWeekOperationKey,
  buildCopyWeekPlanningKey,
  buildShiftOverlapWhere,
  mapShiftToTargetWeek,
  parseWeekStartDateKey,
  toShiftScheduleConflict
} from "./scheduling/shift-scheduling.helpers";
import type { CopyWeekResult } from "./scheduling/shift-scheduling.types";
import { validateVin } from "../vin-decode/vin-validation";
import {
  buildCompanyProfileUpdateData,
  type CompanyProfileUpdateInput
} from "./company-profile.validation";
import {
  buildServiceClientWriteData,
  type ServiceClientWriteInput
} from "./service-client-billing.validation";
import { isLocationLinkedToServiceClient } from "./service-client-location-access";

const DEFAULT_EMPLOYEE_RATE_MINOR = 1900;
const DEFAULT_CLIENT_RATE_MINOR = 2300;

const PIN_PATTERN = /^\d{6}$/;

type EffectiveRateInput = {
  rateMinorUnits: number;
  effectiveStart: string;
  effectiveEnd?: string;
};

type ListOptions = {
  includeArchived?: boolean;
};

type ListShiftsOptions = {
  from?: string;
  to?: string;
  locationId?: string;
  employeeId?: string;
  includeCancelled?: boolean;
};

type CreateShiftInput = {
  employeeId: string;
  serviceClientId: string;
  locationId: string;
  scheduledStartUtc: string;
  scheduledEndUtc: string;
};

type UpdateShiftInput = {
  employeeId?: string;
  scheduledStartUtc: string;
  scheduledEndUtc: string;
};

type CancelShiftInput = {
  cancelReason: string;
};

type CopyWeekInput = {
  sourceWeekStart: string;
  targetWeekStart: string;
  locationId?: string;
  employeeId?: string;
  serviceClientId?: string;
};

type ListVehiclesOptions = {
  includeArchived?: boolean;
  serviceClientId?: string;
  locationId?: string;
  q?: string;
};

type CreateVehicleInput = {
  vin: string;
  serviceClientId: string;
  locationId: string;
  plate?: string;
  color?: string;
  mileage?: number;
  notes?: string;
};

type UpdateVehicleInput = {
  serviceClientId: string;
  locationId: string;
  plate?: string | null;
  color?: string | null;
  mileage?: number | null;
  notes?: string | null;
};

type ListWorkOrdersOptions = {
  serviceClientId?: string;
  locationId?: string;
  status?: WorkOrderStatus;
  q?: string;
};

type CreateWorkOrderInput = {
  vehicleId: string;
  serviceCatalogItemIds: string[];
  notes?: string;
  status?: WorkOrderStatus;
};

type UpdateWorkOrderInput = {
  notes?: string | null;
  status?: WorkOrderStatus;
};

type CancelWorkOrderInput = {
  cancelReason: string;
};

type AssignWorkOrderEmployeeInput = {
  employeeId: string;
  workOrderServiceLineId?: string;
  roleLabel?: string;
};

type UnassignWorkOrderAssignmentInput = {
  unassignReason?: string;
};

type ListClientInvoicesOptions = {
  serviceClientId?: string;
  status?: ClientInvoiceStatus;
  q?: string;
};

type CreateClientInvoiceInput = {
  serviceClientId: string;
  workOrderIds?: string[];
  vehicleId?: string;
  notes?: string;
};

type VoidClientInvoiceInput = {
  voidReason: string;
};

type BillingSettingsInput = {
  invoicePrefix?: string | null;
  paymentTermsDays?: number | null;
  defaultNotes?: string | null;
};

type UpdateClientInvoiceDraftInput = {
  serviceClientId?: string;
  notes?: string | null;
  dueDate?: string | null;
};

type CreateClientInvoiceLineInput = {
  type: "SERVICE" | "PART" | "REPAIR" | "LABOR" | "FEE" | "DISCOUNT" | "OTHER";
  description: string;
  quantity: number;
  unitPriceMinor: number;
  taxable?: boolean;
  taxRate?: number;
  sortOrder?: number;
  vehicleId?: string;
};

type UpdateClientInvoiceLineInput = {
  type?: "SERVICE" | "PART" | "REPAIR" | "LABOR" | "FEE" | "DISCOUNT" | "OTHER";
  description?: string;
  quantity?: number;
  unitPriceMinor?: number;
  taxable?: boolean;
  taxRate?: number;
  sortOrder?: number;
};

@Injectable()
export class CompanyOperationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanyScopeService) private readonly companyScopeService: CompanyScopeService,
    @Inject(VinDecodeService) private readonly vinDecodeService: VinDecodeService,
    @Inject(WeeklyPeriodLockService) private readonly weeklyPeriodLockService: WeeklyPeriodLockService
  ) {}

  async createServiceClient(
    principal: AuthenticatedPrincipal,
    companyId: string,
    input: ServiceClientWriteInput
  ) {
    const company = await this.companyScopeService.requireManagementCompany(principal, companyId);
    const profile = buildServiceClientWriteData(input);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const serviceClient = await tx.serviceClient.create({
        data: {
          groupId: company.groupId,
          companyId,
          ...profile
        }
      });

      const defaultRate = await tx.clientLaborRate.create({
        data: {
          companyId,
          serviceClientId: serviceClient.id,
          rateMinorUnits: DEFAULT_CLIENT_RATE_MINOR,
          currencyCode: "USD",
          effectiveStart: now,
          createdByUserId: principal.userId
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "SERVICE_CLIENT_CREATED",
          targetType: "ServiceClient",
          targetId: serviceClient.id,
          groupId: company.groupId,
          companyId,
          metadata: {
            name: profile.name,
            legalName: profile.legalName,
            billingEmail: profile.billingEmail
          }
        },
        {
          actorUserId: principal.userId,
          action: "CLIENT_RATE_SET",
          targetType: "ClientLaborRate",
          targetId: defaultRate.id,
          groupId: company.groupId,
          companyId,
          metadata: {
            serviceClientId: serviceClient.id,
            rateMinorUnits: DEFAULT_CLIENT_RATE_MINOR,
            currencyCode: "USD"
          }
        }
      ]);

      return serviceClient;
    });
  }

  async listServiceClients(
    principal: AuthenticatedPrincipal,
    companyId: string,
    options: ListOptions
  ) {
    await this.companyScopeService.requireManagementCompany(principal, companyId);

    return this.prisma.serviceClient.findMany({
      where: {
        companyId,
        ...(options.includeArchived ? {} : { archivedAt: null })
      },
      orderBy: { createdAt: "asc" }
    });
  }

  async updateServiceClient(
    principal: AuthenticatedPrincipal,
    serviceClientId: string,
    input: ServiceClientWriteInput
  ) {
    const serviceClient = await this.prisma.serviceClient.findUnique({ where: { id: serviceClientId } });

    if (!serviceClient) {
      throw new NotFoundException("Service client not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, serviceClient.companyId);

    const profile = buildServiceClientWriteData(input);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.serviceClient.update({
        where: { id: serviceClientId },
        data: profile
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "SERVICE_CLIENT_UPDATED",
          targetType: "ServiceClient",
          targetId: serviceClientId,
          groupId: serviceClient.groupId,
          companyId: serviceClient.companyId,
          metadata: {
            name: profile.name,
            legalName: profile.legalName,
            billingEmail: profile.billingEmail
          }
        }
      ]);

      return updated;
    });
  }

  async archiveServiceClient(principal: AuthenticatedPrincipal, serviceClientId: string) {
    const serviceClient = await this.prisma.serviceClient.findUnique({ where: { id: serviceClientId } });

    if (!serviceClient) {
      throw new NotFoundException("Service client not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, serviceClient.companyId);

    return this.prisma.$transaction(async (tx) => {
      const archivedAt = new Date();
      const updated = await tx.serviceClient.update({
        where: { id: serviceClientId },
        data: { archivedAt }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "SERVICE_CLIENT_ARCHIVED",
          targetType: "ServiceClient",
          targetId: serviceClientId,
          groupId: serviceClient.groupId,
          companyId: serviceClient.companyId,
          metadata: { archivedAt: archivedAt.toISOString() }
        }
      ]);

      return updated;
    });
  }

  async unarchiveServiceClient(principal: AuthenticatedPrincipal, serviceClientId: string) {
    const serviceClient = await this.prisma.serviceClient.findUnique({ where: { id: serviceClientId } });
    if (!serviceClient) {
      throw new NotFoundException("Service client not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, serviceClient.companyId);

    if (!serviceClient.archivedAt) {
      throw new BadRequestException("Service client is already active.");
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.serviceClient.update({
        where: { id: serviceClientId },
        data: { archivedAt: null }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "SERVICE_CLIENT_UNARCHIVED",
          targetType: "ServiceClient",
          targetId: serviceClientId,
          groupId: serviceClient.groupId,
          companyId: serviceClient.companyId,
          metadata: {}
        }
      ]);

      return updated;
    });
  }

  async createServiceCatalogItem(
    principal: AuthenticatedPrincipal,
    companyId: string,
    input: {
      name: string;
      description?: string;
      category?: string;
      fixedPriceMinor: number;
      currencyCode?: string;
      sortOrder?: number;
    }
  ) {
    const company = await this.companyScopeService.requireManagementCompany(principal, companyId);
    const name = input.name.trim();
    const description = this.normalizeOptionalText(input.description);
    const category = this.normalizeOptionalText(input.category);
    const currencyCode = this.normalizeCurrencyCode(input.currencyCode);
    const fixedPriceMinor = this.parsePositivePriceMinor(input.fixedPriceMinor);
    const sortOrder = this.parseSortOrder(input.sortOrder);

    if (!name) {
      throw new BadRequestException("Service name is required.");
    }

    await this.assertServiceCatalogNameAvailable(companyId, name);

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.serviceCatalogItem.create({
        data: {
          groupId: company.groupId,
          companyId,
          name,
          description,
          category,
          fixedPriceMinor,
          currencyCode,
          sortOrder
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "SERVICE_CATALOG_ITEM_CREATED",
          targetType: "ServiceCatalogItem",
          targetId: item.id,
          groupId: company.groupId,
          companyId,
          metadata: {
            name,
            category,
            fixedPriceMinor,
            currencyCode,
            sortOrder
          }
        }
      ]);

      return item;
    });
  }

  async listServiceCatalogItems(
    principal: AuthenticatedPrincipal,
    companyId: string,
    options: ListOptions
  ) {
    await this.companyScopeService.requireManagementCompany(principal, companyId);

    return this.prisma.serviceCatalogItem.findMany({
      where: {
        companyId,
        ...(options.includeArchived ? {} : { archivedAt: null })
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { createdAt: "asc" }]
    });
  }

  async getServiceCatalogItem(principal: AuthenticatedPrincipal, serviceCatalogItemId: string) {
    const item = await this.prisma.serviceCatalogItem.findUnique({
      where: { id: serviceCatalogItemId }
    });

    if (!item) {
      throw new NotFoundException("Service catalog item not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, item.companyId);
    return item;
  }

  async updateServiceCatalogItem(
    principal: AuthenticatedPrincipal,
    serviceCatalogItemId: string,
    input: {
      name: string;
      description?: string | null;
      category?: string | null;
      fixedPriceMinor: number;
      currencyCode?: string;
      sortOrder?: number;
    }
  ) {
    const item = await this.prisma.serviceCatalogItem.findUnique({
      where: { id: serviceCatalogItemId }
    });

    if (!item) {
      throw new NotFoundException("Service catalog item not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, item.companyId);

    const name = input.name.trim();
    const description =
      input.description === null ? null : this.normalizeOptionalText(input.description ?? undefined);
    const category = input.category === null ? null : this.normalizeOptionalText(input.category ?? undefined);
    const currencyCode = this.normalizeCurrencyCode(input.currencyCode ?? item.currencyCode);
    const fixedPriceMinor = this.parsePositivePriceMinor(input.fixedPriceMinor);
    const sortOrder =
      input.sortOrder === undefined ? item.sortOrder : this.parseSortOrder(input.sortOrder);

    if (!name) {
      throw new BadRequestException("Service name is required.");
    }

    if (name !== item.name) {
      await this.assertServiceCatalogNameAvailable(item.companyId, name, serviceCatalogItemId);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.serviceCatalogItem.update({
        where: { id: serviceCatalogItemId },
        data: {
          name,
          description,
          category,
          fixedPriceMinor,
          currencyCode,
          sortOrder
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "SERVICE_CATALOG_ITEM_UPDATED",
          targetType: "ServiceCatalogItem",
          targetId: serviceCatalogItemId,
          groupId: item.groupId,
          companyId: item.companyId,
          metadata: {
            name,
            category,
            fixedPriceMinor,
            currencyCode,
            sortOrder
          }
        }
      ]);

      return updated;
    });
  }

  async archiveServiceCatalogItem(principal: AuthenticatedPrincipal, serviceCatalogItemId: string) {
    const item = await this.prisma.serviceCatalogItem.findUnique({
      where: { id: serviceCatalogItemId }
    });

    if (!item) {
      throw new NotFoundException("Service catalog item not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, item.companyId);

    if (item.archivedAt) {
      throw new BadRequestException("Service catalog item is already archived.");
    }

    return this.prisma.$transaction(async (tx) => {
      const archivedAt = new Date();
      const updated = await tx.serviceCatalogItem.update({
        where: { id: serviceCatalogItemId },
        data: { archivedAt }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "SERVICE_CATALOG_ITEM_ARCHIVED",
          targetType: "ServiceCatalogItem",
          targetId: serviceCatalogItemId,
          groupId: item.groupId,
          companyId: item.companyId,
          metadata: { archivedAt: archivedAt.toISOString() }
        }
      ]);

      return updated;
    });
  }

  async unarchiveServiceCatalogItem(principal: AuthenticatedPrincipal, serviceCatalogItemId: string) {
    const item = await this.prisma.serviceCatalogItem.findUnique({
      where: { id: serviceCatalogItemId }
    });

    if (!item) {
      throw new NotFoundException("Service catalog item not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, item.companyId);

    if (!item.archivedAt) {
      throw new BadRequestException("Service catalog item is already active.");
    }

    await this.assertServiceCatalogNameAvailable(item.companyId, item.name, serviceCatalogItemId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.serviceCatalogItem.update({
        where: { id: serviceCatalogItemId },
        data: { archivedAt: null }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "SERVICE_CATALOG_ITEM_UNARCHIVED",
          targetType: "ServiceCatalogItem",
          targetId: serviceCatalogItemId,
          groupId: item.groupId,
          companyId: item.companyId,
          metadata: {}
        }
      ]);

      return updated;
    });
  }

  async previewVehicleVinDecode(
    _principal: AuthenticatedPrincipal,
    input: { vin: string; modelYear?: number }
  ) {
    return this.vinDecodeService.previewVin(input.vin, {
      ...(input.modelYear !== undefined ? { modelYear: input.modelYear } : {})
    });
  }

  async createVehicle(
    principal: AuthenticatedPrincipal,
    companyId: string,
    input: CreateVehicleInput
  ) {
    const company = await this.companyScopeService.requireManagementCompany(principal, companyId);
    const vinValidation = validateVin(input.vin);
    if ("error" in vinValidation) {
      throw new BadRequestException(vinValidation.error);
    }

    const vin = vinValidation.vin;
    await this.assertVehicleVinAvailable(companyId, vin);

    const { serviceClient, location } = await this.resolveVehicleClientLocation(
      companyId,
      input.serviceClientId,
      input.locationId
    );

    const decode = await this.vinDecodeService.decodeVin(vin);
    const decodedAt = new Date(decode.decodedAt);
    const plate = this.normalizeOptionalText(input.plate) ?? null;
    const color = this.normalizeOptionalText(input.color) ?? decode.color;
    const notes = this.normalizeOptionalText(input.notes);
    const mileage = this.parseOptionalNonNegativeMileage(input.mileage);

    return this.prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.create({
        data: {
          groupId: company.groupId,
          companyId,
          serviceClientId: serviceClient.id,
          locationId: location.id,
          vin,
          plate,
          color,
          mileage,
          notes,
          year: decode.year,
          make: decode.make,
          model: decode.model,
          trim: decode.trim,
          bodyClass: decode.bodyClass,
          vehicleType: decode.vehicleType,
          fuelType: decode.fuelType,
          decodedAt,
          decodeSource: decode.source,
          decodePayload: decode.rawPayload
        },
        include: this.vehicleInclude()
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "VEHICLE_CREATED",
          targetType: "Vehicle",
          targetId: vehicle.id,
          groupId: company.groupId,
          companyId,
          metadata: { vin, serviceClientId: serviceClient.id, locationId: location.id, decodeSource: decode.source }
        }
      ]);

      return vehicle;
    });
  }

  async listVehicles(
    principal: AuthenticatedPrincipal,
    companyId: string,
    options: ListVehiclesOptions
  ) {
    await this.companyScopeService.requireManagementCompany(principal, companyId);

    const search = options.q?.trim();
    return this.prisma.vehicle.findMany({
      where: {
        companyId,
        ...(options.includeArchived ? {} : { archivedAt: null }),
        ...(options.serviceClientId ? { serviceClientId: options.serviceClientId } : {}),
        ...(options.locationId ? { locationId: options.locationId } : {}),
        ...(search
          ? {
              OR: [
                { vin: { contains: search, mode: "insensitive" } },
                { plate: { contains: search, mode: "insensitive" } },
                { make: { contains: search, mode: "insensitive" } },
                { model: { contains: search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      include: this.vehicleInclude(),
      orderBy: [{ createdAt: "desc" }]
    });
  }

  async searchVehiclesForReception(
    principal: AuthenticatedPrincipal,
    companyId: string,
    query: string
  ) {
    await this.companyScopeService.requireManagementCompany(principal, companyId);

    const normalized = query.trim().toUpperCase().replace(/\s+/g, "");
    if (!normalized) {
      return [];
    }

    const isActive = { archivedAt: null };

    const byVin = await this.prisma.vehicle.findFirst({
      where: { companyId, ...isActive, vin: normalized },
      include: {
        ...this.vehicleInclude(),
        workOrders: {
          where: { companyId },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            id: true,
            workOrderNumber: true,
            status: true,
            createdAt: true,
            serviceLines: {
              select: { serviceNameSnapshot: true }
            }
          }
        }
      }
    });

    if (byVin) {
      return [{ match: "vin_exact" as const, vehicle: byVin }];
    }

    const search = query.trim();
    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        companyId,
        ...isActive,
        OR: [
          { vin: { contains: search, mode: "insensitive" } },
          { plate: { contains: search, mode: "insensitive" } },
          { make: { contains: search, mode: "insensitive" } },
          { model: { contains: search, mode: "insensitive" } },
          { serviceClient: { name: { contains: search, mode: "insensitive" } } }
        ]
      },
      include: {
        ...this.vehicleInclude(),
        workOrders: {
          where: { companyId },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            id: true,
            workOrderNumber: true,
            status: true,
            createdAt: true,
            serviceLines: {
              select: { serviceNameSnapshot: true }
            }
          }
        }
      },
      orderBy: [{ createdAt: "desc" }],
      take: 10
    });

    return vehicles.map((v) => ({ match: "search" as const, vehicle: v }));
  }

  async getVehicle(principal: AuthenticatedPrincipal, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: this.vehicleInclude()
    });

    if (!vehicle) {
      throw new NotFoundException("Vehicle not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, vehicle.companyId);
    return vehicle;
  }

  async updateVehicle(
    principal: AuthenticatedPrincipal,
    vehicleId: string,
    input: UpdateVehicleInput
  ) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new NotFoundException("Vehicle not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, vehicle.companyId);

    const { serviceClient, location } = await this.resolveVehicleClientLocation(
      vehicle.companyId,
      input.serviceClientId,
      input.locationId
    );

    const plate = input.plate === null ? null : this.normalizeOptionalText(input.plate ?? undefined);
    const color = input.color === null ? null : this.normalizeOptionalText(input.color ?? undefined);
    const notes = input.notes === null ? null : this.normalizeOptionalText(input.notes ?? undefined);
    const mileage = this.parseOptionalNonNegativeMileage(input.mileage ?? undefined, true);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.vehicle.update({
        where: { id: vehicleId },
        data: {
          serviceClientId: serviceClient.id,
          locationId: location.id,
          plate,
          color,
          mileage,
          notes
        },
        include: this.vehicleInclude()
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "VEHICLE_UPDATED",
          targetType: "Vehicle",
          targetId: vehicleId,
          groupId: vehicle.groupId,
          companyId: vehicle.companyId,
          metadata: {
            vin: vehicle.vin,
            serviceClientId: serviceClient.id,
            locationId: location.id
          }
        }
      ]);

      return updated;
    });
  }

  async archiveVehicle(principal: AuthenticatedPrincipal, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new NotFoundException("Vehicle not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, vehicle.companyId);

    if (vehicle.archivedAt) {
      throw new BadRequestException("Vehicle is already archived.");
    }

    return this.prisma.$transaction(async (tx) => {
      const archivedAt = new Date();
      const updated = await tx.vehicle.update({
        where: { id: vehicleId },
        data: { archivedAt },
        include: this.vehicleInclude()
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "VEHICLE_ARCHIVED",
          targetType: "Vehicle",
          targetId: vehicleId,
          groupId: vehicle.groupId,
          companyId: vehicle.companyId,
          metadata: { archivedAt: archivedAt.toISOString(), vin: vehicle.vin }
        }
      ]);

      return updated;
    });
  }

  async unarchiveVehicle(principal: AuthenticatedPrincipal, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new NotFoundException("Vehicle not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, vehicle.companyId);

    if (!vehicle.archivedAt) {
      throw new BadRequestException("Vehicle is already active.");
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.vehicle.update({
        where: { id: vehicleId },
        data: { archivedAt: null },
        include: this.vehicleInclude()
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "VEHICLE_UNARCHIVED",
          targetType: "Vehicle",
          targetId: vehicleId,
          groupId: vehicle.groupId,
          companyId: vehicle.companyId,
          metadata: { vin: vehicle.vin }
        }
      ]);

      return updated;
    });
  }

  async createWorkOrder(
    principal: AuthenticatedPrincipal,
    companyId: string,
    input: CreateWorkOrderInput
  ) {
    const company = await this.companyScopeService.requireManagementCompany(principal, companyId);
    const vehicle = await this.resolveActiveVehicleForWorkOrder(companyId, input.vehicleId);
    const catalogItems = await this.resolveActiveCatalogItemsForWorkOrder(
      companyId,
      input.serviceCatalogItemIds
    );
    const initialStatus = this.parseWorkOrderCreateStatus(input.status);
    const notes = this.normalizeOptionalText(input.notes);

    return this.prisma.$transaction(async (tx) => {
      const workOrderNumber = await this.generateWorkOrderNumber(tx, companyId);
      const workOrder = await tx.workOrder.create({
        data: {
          groupId: company.groupId,
          companyId,
          serviceClientId: vehicle.serviceClientId,
          locationId: vehicle.locationId,
          vehicleId: vehicle.id,
          workOrderNumber,
          status: initialStatus,
          notes,
          startedAt: new Date(),
          serviceLines: {
            create: catalogItems.map((item) => ({
              groupId: company.groupId,
              companyId,
              serviceCatalogItemId: item.id,
              serviceNameSnapshot: item.name,
              serviceCategorySnapshot: item.category,
              unitPriceMinor: item.fixedPriceMinor,
              currencyCode: item.currencyCode,
              quantity: 1,
              lineTotalMinor: item.fixedPriceMinor
            }))
          },
          statusHistory: {
            create: {
              groupId: company.groupId,
              companyId,
              fromStatus: null,
              toStatus: initialStatus,
              createdByUserId: principal.userId
            }
          }
        },
        include: this.workOrderInclude()
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "WORK_ORDER_CREATED",
          targetType: "WorkOrder",
          targetId: workOrder.id,
          groupId: company.groupId,
          companyId,
          metadata: {
            workOrderNumber,
            vehicleId: vehicle.id,
            status: initialStatus,
            serviceLineCount: catalogItems.length
          }
        }
      ]);

      return this.mapWorkOrder(workOrder);
    });
  }

  async listWorkOrders(
    principal: AuthenticatedPrincipal,
    companyId: string,
    options: ListWorkOrdersOptions
  ) {
    const access = await this.companyScopeService.getCompanyAccessContext(principal, companyId);
    await this.companyScopeService.assertLocationFilterAllowed(principal, companyId, options.locationId);

    const search = options.q?.trim();
    const locationScope = this.buildWorkOrderLocationFilter(access, options.locationId);

    const workOrders = await this.prisma.workOrder.findMany({
      where: {
        companyId,
        ...locationScope,
        ...(options.serviceClientId ? { serviceClientId: options.serviceClientId } : {}),
        ...(options.status ? { status: options.status } : {}),
        ...(search
          ? {
              OR: [
                { workOrderNumber: { contains: search, mode: "insensitive" } },
                {
                  vehicle: {
                    OR: [
                      { vin: { contains: search, mode: "insensitive" } },
                      { plate: { contains: search, mode: "insensitive" } },
                      { make: { contains: search, mode: "insensitive" } },
                      { model: { contains: search, mode: "insensitive" } }
                    ]
                  }
                },
                {
                  serviceLines: {
                    some: { serviceNameSnapshot: { contains: search, mode: "insensitive" } }
                  }
                }
              ]
            }
          : {})
      },
      include: this.workOrderInclude(),
      orderBy: [{ createdAt: "desc" }]
    });

    return workOrders.map((workOrder) => this.mapWorkOrder(workOrder));
  }

  async getWorkOrder(principal: AuthenticatedPrincipal, workOrderId: string) {
    const workOrder = await this.requireWorkOrderOperationalAccess(principal, workOrderId);
    return this.mapWorkOrder(workOrder);
  }

  async updateWorkOrder(
    principal: AuthenticatedPrincipal,
    workOrderId: string,
    input: UpdateWorkOrderInput
  ) {
    const workOrder = await this.prisma.workOrder.findUnique({ where: { id: workOrderId } });
    if (!workOrder) {
      throw new NotFoundException("Work order not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, workOrder.companyId);

    if (workOrder.status === WorkOrderStatus.CANCELLED) {
      throw new BadRequestException("Cancelled work orders cannot be edited.");
    }

    if (workOrder.status === WorkOrderStatus.COMPLETED) {
      throw new BadRequestException("Completed work orders cannot be edited.");
    }

    if (workOrder.status === WorkOrderStatus.INVOICED) {
      throw new BadRequestException("Invoiced work orders cannot be edited.");
    }

    const notes =
      input.notes === undefined ? undefined : input.notes === null ? null : this.normalizeOptionalText(input.notes);
    const nextStatus = input.status;

    if (nextStatus !== undefined) {
      this.assertWorkOrderStatusTransition(workOrder.status, nextStatus);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.workOrder.update({
        where: { id: workOrderId },
        data: {
          ...(notes !== undefined ? { notes } : {}),
          ...(nextStatus !== undefined ? { status: nextStatus } : {})
        },
        include: this.workOrderInclude()
      });

      if (nextStatus !== undefined && nextStatus !== workOrder.status) {
        await tx.workOrderStatusHistory.create({
          data: {
            groupId: workOrder.groupId,
            companyId: workOrder.companyId,
            workOrderId,
            fromStatus: workOrder.status,
            toStatus: nextStatus,
            createdByUserId: principal.userId
          }
        });
      }

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "WORK_ORDER_UPDATED",
          targetType: "WorkOrder",
          targetId: workOrderId,
          groupId: workOrder.groupId,
          companyId: workOrder.companyId,
          metadata: {
            workOrderNumber: workOrder.workOrderNumber,
            ...(nextStatus !== undefined ? { status: nextStatus } : {})
          }
        }
      ]);

      return this.mapWorkOrder(updated);
    });
  }

  async cancelWorkOrder(
    principal: AuthenticatedPrincipal,
    workOrderId: string,
    input: CancelWorkOrderInput
  ) {
    const workOrder = await this.prisma.workOrder.findUnique({ where: { id: workOrderId } });
    if (!workOrder) {
      throw new NotFoundException("Work order not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, workOrder.companyId);

    if (workOrder.status === WorkOrderStatus.CANCELLED) {
      throw new BadRequestException("Work order is already cancelled.");
    }

    const cancelReason = input.cancelReason?.trim() ?? "";
    if (!cancelReason) {
      throw new BadRequestException("Cancel reason is required.");
    }

    return this.prisma.$transaction(async (tx) => {
      const cancelledAt = new Date();
      const updated = await tx.workOrder.update({
        where: { id: workOrderId },
        data: {
          status: WorkOrderStatus.CANCELLED,
          cancelledAt,
          cancelReason
        },
        include: this.workOrderInclude()
      });

      await tx.workOrderStatusHistory.create({
        data: {
          groupId: workOrder.groupId,
          companyId: workOrder.companyId,
          workOrderId,
          fromStatus: workOrder.status,
          toStatus: WorkOrderStatus.CANCELLED,
          reason: cancelReason,
          createdByUserId: principal.userId
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "WORK_ORDER_CANCELLED",
          targetType: "WorkOrder",
          targetId: workOrderId,
          groupId: workOrder.groupId,
          companyId: workOrder.companyId,
          metadata: {
            workOrderNumber: workOrder.workOrderNumber,
            cancelReason
          }
        }
      ]);

      return this.mapWorkOrder(updated);
    });
  }

  async addServiceLineToWorkOrder(
    principal: AuthenticatedPrincipal,
    workOrderId: string,
    input: { serviceCatalogItemIds: string[] }
  ) {
    const workOrder = await this.requireWorkOrderOperationalAccess(principal, workOrderId);

    if (workOrder.status === WorkOrderStatus.CANCELLED) {
      throw new BadRequestException("Cannot add services to a cancelled work order.");
    }

    if (workOrder.status === WorkOrderStatus.COMPLETED) {
      throw new BadRequestException("Cannot add services to a completed work order.");
    }

    if (workOrder.status === WorkOrderStatus.INVOICED) {
      throw new BadRequestException("Cannot add services to an invoiced work order.");
    }

    const catalogItems = await this.resolveActiveCatalogItemsForWorkOrder(
      workOrder.companyId,
      input.serviceCatalogItemIds
    );

    return this.prisma.$transaction(async (tx) => {
      const lines = await Promise.all(
        catalogItems.map((item) =>
          tx.workOrderServiceLine.create({
            data: {
              groupId: workOrder.groupId,
              companyId: workOrder.companyId,
              workOrderId: workOrder.id,
              serviceCatalogItemId: item.id,
              serviceNameSnapshot: item.name,
              serviceCategorySnapshot: item.category,
              unitPriceMinor: item.fixedPriceMinor,
              currencyCode: item.currencyCode,
              quantity: 1,
              lineTotalMinor: item.fixedPriceMinor
            }
          })
        )
      );

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "WORK_ORDER_SERVICE_LINES_ADDED",
          targetType: "WorkOrder",
          targetId: workOrderId,
          groupId: workOrder.groupId,
          companyId: workOrder.companyId,
          metadata: {
            workOrderNumber: workOrder.workOrderNumber,
            addedCount: lines.length,
            serviceNames: catalogItems.map((i) => i.name)
          }
        }
      ]);

      const refreshed = await tx.workOrder.findUnique({
        where: { id: workOrderId },
        include: this.workOrderInclude()
      });

      return this.mapWorkOrder(refreshed!);
    });
  }

  async assignWorkOrderEmployee(
    principal: AuthenticatedPrincipal,
    workOrderId: string,
    input: AssignWorkOrderEmployeeInput
  ) {
    const workOrder = await this.requireWorkOrderOperationalAccess(principal, workOrderId);

    if (workOrder.status === WorkOrderStatus.CANCELLED) {
      throw new BadRequestException("Cancelled work orders cannot be assigned.");
    }

    if (workOrder.status === WorkOrderStatus.COMPLETED) {
      throw new BadRequestException("Completed work orders cannot be assigned.");
    }

    if (workOrder.status === WorkOrderStatus.INVOICED) {
      throw new BadRequestException("Invoiced work orders cannot be assigned.");
    }

    const employeeId = input.employeeId?.trim() ?? "";
    if (!employeeId) {
      throw new BadRequestException("Employee is required.");
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId: workOrder.companyId, archivedAt: null }
    });

    if (!employee) {
      throw new BadRequestException("Active employee not found for this company.");
    }

    const serviceLineId = input.workOrderServiceLineId?.trim() || null;
    if (serviceLineId) {
      const serviceLine = await this.prisma.workOrderServiceLine.findFirst({
        where: { id: serviceLineId, workOrderId, companyId: workOrder.companyId }
      });

      if (!serviceLine) {
        throw new BadRequestException("Service line must belong to this work order.");
      }
    }

    const roleLabel = this.normalizeOptionalText(input.roleLabel);

    return this.prisma.$transaction(async (tx) => {
      const existingActive = await tx.workOrderAssignment.findFirst({
        where: {
          workOrderId,
          companyId: workOrder.companyId,
          workOrderServiceLineId: serviceLineId,
          unassignedAt: null
        },
        include: { employee: { select: { id: true, fullName: true } } }
      });

      if (existingActive?.employeeId === employeeId) {
        throw new BadRequestException("Employee is already assigned to this scope.");
      }

      const now = new Date();

      if (existingActive) {
        await tx.workOrderAssignment.update({
          where: { id: existingActive.id },
          data: {
            unassignedAt: now,
            unassignedByUserId: principal.userId,
            unassignReason: "Reassigned"
          }
        });

        await tx.vehicleResponsibilityLog.create({
          data: {
            groupId: workOrder.groupId,
            companyId: workOrder.companyId,
            workOrderId,
            vehicleId: workOrder.vehicleId,
            employeeId: existingActive.employeeId,
            action: "UNASSIGNED",
            actorUserId: principal.userId,
            occurredAt: now,
            details: {
              source: "ADMIN",
              reason: "Reassigned",
              assignmentId: existingActive.id,
              workOrderServiceLineId: serviceLineId
            }
          }
        });
      }

      const assignment = await tx.workOrderAssignment.create({
        data: {
          groupId: workOrder.groupId,
          companyId: workOrder.companyId,
          workOrderId,
          workOrderServiceLineId: serviceLineId,
          employeeId,
          roleLabel,
          assignedByUserId: principal.userId
        },
        include: {
          employee: { select: { id: true, fullName: true } }
        }
      });

      await tx.vehicleResponsibilityLog.create({
        data: {
          groupId: workOrder.groupId,
          companyId: workOrder.companyId,
          workOrderId,
          vehicleId: workOrder.vehicleId,
          employeeId,
          action: existingActive ? "REASSIGNED" : "ASSIGNED",
          actorUserId: principal.userId,
          occurredAt: now,
          details: {
            source: "ADMIN",
            assignmentId: assignment.id,
            workOrderServiceLineId: serviceLineId,
            ...(existingActive
              ? { previousEmployeeId: existingActive.employeeId, previousAssignmentId: existingActive.id }
              : {})
          }
        }
      });

      let nextStatus = workOrder.status;
      if (
        !serviceLineId &&
        (workOrder.status === WorkOrderStatus.DRAFT || workOrder.status === WorkOrderStatus.READY)
      ) {
        nextStatus = WorkOrderStatus.ASSIGNED;
      }

      if (nextStatus !== workOrder.status) {
        await tx.workOrder.update({
          where: { id: workOrderId },
          data: { status: nextStatus }
        });

        await tx.workOrderStatusHistory.create({
          data: {
            groupId: workOrder.groupId,
            companyId: workOrder.companyId,
            workOrderId,
            fromStatus: workOrder.status,
            toStatus: nextStatus,
            reason: "Employee assigned",
            createdByUserId: principal.userId
          }
        });
      }

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: existingActive ? "WORK_ORDER_EMPLOYEE_REASSIGNED" : "WORK_ORDER_EMPLOYEE_ASSIGNED",
          targetType: "WorkOrder",
          targetId: workOrderId,
          groupId: workOrder.groupId,
          companyId: workOrder.companyId,
          metadata: {
            workOrderNumber: workOrder.workOrderNumber,
            employeeId,
            assignmentId: assignment.id,
            workOrderServiceLineId: serviceLineId
          }
        }
      ]);

      const refreshed = await tx.workOrder.findUniqueOrThrow({
        where: { id: workOrderId },
        include: this.workOrderInclude()
      });

      return this.mapWorkOrder(refreshed);
    });
  }

  async unassignWorkOrderAssignment(
    principal: AuthenticatedPrincipal,
    assignmentId: string,
    input: UnassignWorkOrderAssignmentInput
  ) {
    const assignment = await this.prisma.workOrderAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        workOrder: true,
        employee: { select: { id: true, fullName: true } }
      }
    });

    if (!assignment) {
      throw new NotFoundException("Work order assignment not found.");
    }

    await this.requireWorkOrderOperationalAccess(principal, assignment.workOrderId);

    if (assignment.unassignedAt) {
      throw new BadRequestException("Assignment is already inactive.");
    }

    const unassignReason = this.normalizeOptionalText(input.unassignReason) ?? null;
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.workOrderAssignment.update({
        where: { id: assignmentId },
        data: {
          unassignedAt: now,
          unassignedByUserId: principal.userId,
          unassignReason
        }
      });

      await tx.vehicleResponsibilityLog.create({
        data: {
          groupId: assignment.groupId,
          companyId: assignment.companyId,
          workOrderId: assignment.workOrderId,
          vehicleId: assignment.workOrder.vehicleId,
          employeeId: assignment.employeeId,
          action: "UNASSIGNED",
          actorUserId: principal.userId,
          occurredAt: now,
          details: {
            source: "ADMIN",
            assignmentId,
            workOrderServiceLineId: assignment.workOrderServiceLineId,
            reason: unassignReason
          }
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "WORK_ORDER_EMPLOYEE_UNASSIGNED",
          targetType: "WorkOrder",
          targetId: assignment.workOrderId,
          groupId: assignment.groupId,
          companyId: assignment.companyId,
          metadata: {
            workOrderNumber: assignment.workOrder.workOrderNumber,
            employeeId: assignment.employeeId,
            assignmentId
          }
        }
      ]);

      const refreshed = await tx.workOrder.findUniqueOrThrow({
        where: { id: assignment.workOrderId },
        include: this.workOrderInclude()
      });

      return this.mapWorkOrder(refreshed);
    });
  }

  async addServiceClientRate(
    principal: AuthenticatedPrincipal,
    serviceClientId: string,
    input: EffectiveRateInput
  ) {
    const serviceClient = await this.prisma.serviceClient.findUnique({ where: { id: serviceClientId } });

    if (!serviceClient) {
      throw new NotFoundException("Service client not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, serviceClient.companyId);

    const period = this.validateRatePeriod(input.effectiveStart, input.effectiveEnd);
    this.validateRateAmount(input.rateMinorUnits);

    await this.ensureClientRatePeriodNoOverlap({
      companyId: serviceClient.companyId,
      serviceClientId,
      locationId: null,
      start: period.start,
      end: period.end
    });

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.clientLaborRate.create({
        data: {
          companyId: serviceClient.companyId,
          serviceClientId,
          rateMinorUnits: input.rateMinorUnits,
          currencyCode: "USD",
          effectiveStart: period.start,
          ...(period.end ? { effectiveEnd: period.end } : {}),
          createdByUserId: principal.userId
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "CLIENT_RATE_SET",
          targetType: "ClientLaborRate",
          targetId: created.id,
          groupId: serviceClient.groupId,
          companyId: serviceClient.companyId,
          metadata: {
            serviceClientId,
            rateMinorUnits: input.rateMinorUnits,
            effectiveStart: period.start.toISOString(),
            effectiveEnd: period.end?.toISOString() ?? null
          }
        }
      ]);

      return created;
    });
  }

  async listServiceClientRates(
    principal: AuthenticatedPrincipal,
    serviceClientId: string
  ) {
    const serviceClient = await this.prisma.serviceClient.findUnique({ where: { id: serviceClientId } });
    if (!serviceClient) {
      throw new NotFoundException("Service client not found.");
    }
    await this.companyScopeService.requireManagementCompany(principal, serviceClient.companyId);

    return this.prisma.clientLaborRate.findMany({
      where: {
        companyId: serviceClient.companyId,
        serviceClientId,
        locationId: null
      },
      orderBy: { effectiveStart: "asc" }
    });
  }

  async createLocation(
    principal: AuthenticatedPrincipal,
    companyId: string,
    input: { serviceClientId: string; name: string; timezone: string }
  ) {
    const company = await this.companyScopeService.requireManagementCompany(principal, companyId);
    const name = input.name.trim();
    const timezone = input.timezone.trim();

    if (!name) {
      throw new BadRequestException("Location name is required.");
    }

    if (!this.isValidIanaTimeZone(timezone)) {
      throw new BadRequestException("Location timezone must be a valid IANA timezone.");
    }

    const serviceClient = await this.prisma.serviceClient.findFirst({
      where: {
        id: input.serviceClientId,
        companyId,
        archivedAt: null
      }
    });

    if (!serviceClient) {
      throw new BadRequestException(
        "Location service client must exist, be active, and belong to the same company."
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const location = await tx.location.create({
        data: {
          groupId: company.groupId,
          companyId,
          serviceClientId: serviceClient.id,
          name,
          timezone
        }
      });

      await tx.serviceClientLocation.create({
        data: {
          groupId: company.groupId,
          companyId,
          serviceClientId: serviceClient.id,
          locationId: location.id
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "LOCATION_CREATED",
          targetType: "Location",
          targetId: location.id,
          groupId: company.groupId,
          companyId,
          metadata: {
            serviceClientId: serviceClient.id,
            timezone
          }
        }
      ]);

      return location;
    });
  }

  async listLocations(principal: AuthenticatedPrincipal, companyId: string, options: ListOptions) {
    const access = await this.companyScopeService.getCompanyAccessContext(principal, companyId);
    const locationScope = this.companyScopeService.buildLocationEntityFilter(access);

    const locations = await this.prisma.location.findMany({
      where: {
        companyId,
        ...locationScope,
        ...(options.includeArchived ? {} : { archivedAt: null })
      },
      include: {
        serviceClientLinks: {
          select: { serviceClientId: true }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    return locations.map(({ serviceClientLinks, ...location }) => ({
      ...location,
      linkedServiceClientIds: serviceClientLinks.map((link) => link.serviceClientId)
    }));
  }

  async linkLocationToServiceClient(
    principal: AuthenticatedPrincipal,
    serviceClientId: string,
    locationId: string
  ) {
    const serviceClient = await this.prisma.serviceClient.findUnique({ where: { id: serviceClientId } });
    if (!serviceClient || serviceClient.archivedAt) {
      throw new NotFoundException("Service client not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, serviceClient.companyId);

    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        companyId: serviceClient.companyId,
        archivedAt: null
      }
    });

    if (!location) {
      throw new BadRequestException("Location must exist, be active, and belong to the same company.");
    }

    const existing = await this.prisma.serviceClientLocation.findUnique({
      where: {
        serviceClientId_locationId: {
          serviceClientId: serviceClient.id,
          locationId: location.id
        }
      }
    });

    if (existing) {
      return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      const link = await tx.serviceClientLocation.create({
        data: {
          groupId: serviceClient.groupId,
          companyId: serviceClient.companyId,
          serviceClientId: serviceClient.id,
          locationId: location.id
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "SERVICE_CLIENT_LOCATION_LINKED",
          targetType: "ServiceClientLocation",
          targetId: link.id,
          groupId: serviceClient.groupId,
          companyId: serviceClient.companyId,
          metadata: {
            serviceClientId: serviceClient.id,
            locationId: location.id
          }
        }
      ]);

      return link;
    });
  }

  async unlinkLocationFromServiceClient(
    principal: AuthenticatedPrincipal,
    serviceClientId: string,
    locationId: string
  ) {
    const serviceClient = await this.prisma.serviceClient.findUnique({ where: { id: serviceClientId } });
    if (!serviceClient) {
      throw new NotFoundException("Service client not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, serviceClient.companyId);

    const location = await this.prisma.location.findFirst({
      where: { id: locationId, companyId: serviceClient.companyId }
    });

    if (!location) {
      throw new NotFoundException("Location not found.");
    }

    if (location.serviceClientId === serviceClient.id) {
      throw new BadRequestException(
        "Cannot unlink the primary client from this location. Change the primary client on the location first."
      );
    }

    const link = await this.prisma.serviceClientLocation.findUnique({
      where: {
        serviceClientId_locationId: {
          serviceClientId: serviceClient.id,
          locationId: location.id
        }
      }
    });

    if (!link) {
      throw new NotFoundException("Location link not found.");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.serviceClientLocation.delete({ where: { id: link.id } });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "SERVICE_CLIENT_LOCATION_UNLINKED",
          targetType: "ServiceClientLocation",
          targetId: link.id,
          groupId: serviceClient.groupId,
          companyId: serviceClient.companyId,
          metadata: {
            serviceClientId: serviceClient.id,
            locationId: location.id
          }
        }
      ]);

      return { ok: true };
    });
  }

  async updateLocation(
    principal: AuthenticatedPrincipal,
    locationId: string,
    input: { name: string; timezone: string; serviceClientId: string }
  ) {
    const location = await this.prisma.location.findUnique({ where: { id: locationId } });

    if (!location) {
      throw new NotFoundException("Location not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, location.companyId);

    const name = input.name.trim();
    const timezone = input.timezone.trim();

    if (!name) {
      throw new BadRequestException("Location name is required.");
    }

    if (!this.isValidIanaTimeZone(timezone)) {
      throw new BadRequestException("Location timezone must be a valid IANA timezone.");
    }

    const serviceClient = await this.prisma.serviceClient.findFirst({
      where: {
        id: input.serviceClientId,
        companyId: location.companyId,
        archivedAt: null
      }
    });

    if (!serviceClient) {
      throw new BadRequestException(
        "Location service client must exist, be active, and belong to the same company."
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.location.update({
        where: { id: locationId },
        data: {
          name,
          timezone,
          serviceClientId: serviceClient.id
        }
      });

      await tx.serviceClientLocation.upsert({
        where: {
          serviceClientId_locationId: {
            serviceClientId: serviceClient.id,
            locationId
          }
        },
        create: {
          groupId: location.groupId,
          companyId: location.companyId,
          serviceClientId: serviceClient.id,
          locationId
        },
        update: {}
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "LOCATION_UPDATED",
          targetType: "Location",
          targetId: locationId,
          groupId: location.groupId,
          companyId: location.companyId,
          metadata: {
            timezone,
            serviceClientId: serviceClient.id
          }
        }
      ]);

      return updated;
    });
  }

  async getLocation(principal: AuthenticatedPrincipal, locationId: string) {
    return this.companyScopeService.requireLocationAccess(principal, locationId);
  }

  async unarchiveLocation(principal: AuthenticatedPrincipal, locationId: string) {
    const location = await this.prisma.location.findUnique({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException("Location not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, location.companyId);

    if (!location.archivedAt) {
      throw new BadRequestException("Location is already active.");
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.location.update({
        where: { id: locationId },
        data: { archivedAt: null }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "LOCATION_UNARCHIVED",
          targetType: "Location",
          targetId: locationId,
          groupId: location.groupId,
          companyId: location.companyId,
          metadata: {}
        }
      ]);

      return updated;
    });
  }

  async archiveLocation(principal: AuthenticatedPrincipal, locationId: string) {
    const location = await this.prisma.location.findUnique({ where: { id: locationId } });

    if (!location) {
      throw new NotFoundException("Location not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, location.companyId);

    return this.prisma.$transaction(async (tx) => {
      const archivedAt = new Date();
      const updated = await tx.location.update({
        where: { id: locationId },
        data: { archivedAt }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "LOCATION_ARCHIVED",
          targetType: "Location",
          targetId: locationId,
          groupId: location.groupId,
          companyId: location.companyId,
          metadata: { archivedAt: archivedAt.toISOString() }
        }
      ]);

      return updated;
    });
  }

  async addLocationRate(
    principal: AuthenticatedPrincipal,
    locationId: string,
    input: EffectiveRateInput
  ) {
    const location = await this.prisma.location.findUnique({ where: { id: locationId } });

    if (!location) {
      throw new NotFoundException("Location not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, location.companyId);

    const period = this.validateRatePeriod(input.effectiveStart, input.effectiveEnd);
    this.validateRateAmount(input.rateMinorUnits);

    await this.ensureClientRatePeriodNoOverlap({
      companyId: location.companyId,
      serviceClientId: null,
      locationId,
      start: period.start,
      end: period.end
    });

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.clientLaborRate.create({
        data: {
          companyId: location.companyId,
          locationId,
          rateMinorUnits: input.rateMinorUnits,
          currencyCode: "USD",
          effectiveStart: period.start,
          ...(period.end ? { effectiveEnd: period.end } : {}),
          createdByUserId: principal.userId
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "LOCATION_RATE_SET",
          targetType: "ClientLaborRate",
          targetId: created.id,
          groupId: location.groupId,
          companyId: location.companyId,
          metadata: {
            locationId,
            rateMinorUnits: input.rateMinorUnits,
            effectiveStart: period.start.toISOString(),
            effectiveEnd: period.end?.toISOString() ?? null
          }
        }
      ]);

      return created;
    });
  }

  async listLocationRates(principal: AuthenticatedPrincipal, locationId: string) {
    const location = await this.prisma.location.findUnique({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException("Location not found.");
    }
    await this.companyScopeService.requireManagementCompany(principal, location.companyId);

    return this.prisma.clientLaborRate.findMany({
      where: {
        companyId: location.companyId,
        locationId
      },
      orderBy: { effectiveStart: "asc" }
    });
  }

  async createEmployee(
    principal: AuthenticatedPrincipal,
    companyId: string,
    input: { fullName: string; pin: string }
  ) {
    const company = await this.companyScopeService.requireManagementCompany(principal, companyId);
    const fullName = input.fullName.trim();

    if (!fullName) {
      throw new BadRequestException("Employee full name is required.");
    }

    this.validatePin(input.pin);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${companyId}));
      `;

      await this.ensurePinUniqueInCompany(tx, companyId, input.pin);

      const pinHash = await this.hashPin(input.pin);
      const now = new Date();

      const employee = await tx.employee.create({
        data: {
          groupId: company.groupId,
          companyId,
          fullName
        }
      });

      const pinCredential = await tx.employeePinCredential.create({
        data: {
          employeeId: employee.id,
          companyId,
          pinHash,
          createdByUserId: principal.userId
        }
      });

      const defaultRate = await tx.employeeRate.create({
        data: {
          employeeId: employee.id,
          companyId,
          rateMinorUnits: DEFAULT_EMPLOYEE_RATE_MINOR,
          currencyCode: "USD",
          effectiveStart: now,
          createdByUserId: principal.userId
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "EMPLOYEE_CREATED",
          targetType: "Employee",
          targetId: employee.id,
          groupId: company.groupId,
          companyId,
          metadata: { fullName }
        },
        {
          actorUserId: principal.userId,
          action: "EMPLOYEE_RATE_SET",
          targetType: "EmployeeRate",
          targetId: defaultRate.id,
          groupId: company.groupId,
          companyId,
          metadata: {
            employeeId: employee.id,
            rateMinorUnits: DEFAULT_EMPLOYEE_RATE_MINOR,
            currencyCode: "USD"
          }
        },
        {
          actorUserId: principal.userId,
          action: "EMPLOYEE_PIN_SET",
          targetType: "EmployeePinCredential",
          targetId: pinCredential.id,
          groupId: company.groupId,
          companyId,
          metadata: { employeeId: employee.id }
        }
      ]);

      return employee;
    });
  }

  async listEmployees(principal: AuthenticatedPrincipal, companyId: string, options: ListOptions) {
    await this.companyScopeService.requireManagementCompany(principal, companyId);

    return this.prisma.employee.findMany({
      where: {
        companyId,
        ...(options.includeArchived ? {} : { archivedAt: null })
      },
      orderBy: { createdAt: "asc" }
    });
  }

  async updateEmployee(
    principal: AuthenticatedPrincipal,
    employeeId: string,
    input: { fullName: string }
  ) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, employee.companyId);

    const fullName = input.fullName.trim();
    if (!fullName) {
      throw new BadRequestException("Employee full name is required.");
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: { fullName }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "EMPLOYEE_UPDATED",
          targetType: "Employee",
          targetId: employeeId,
          groupId: employee.groupId,
          companyId: employee.companyId,
          metadata: { fullName }
        }
      ]);

      return updated;
    });
  }

  async getEmployee(principal: AuthenticatedPrincipal, employeeId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, employee.companyId);
    return employee;
  }

  async getEmployeeProfile(
    principal: AuthenticatedPrincipal,
    companyId: string,
    employeeId: string
  ) {
    // Verify employee belongs to the company
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId }
    });
    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, companyId);

    // Return profile fields only (excludes sensitive data like PIN)
    return {
      id: employee.id,
      fullName: employee.fullName,
      archivedAt: employee.archivedAt,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
      photoUrl: employee.photoUrl,
      photoUpdatedAt: employee.photoUpdatedAt,
      phone: employee.phone,
      email: employee.email,
      title: employee.title,
      department: employee.department,
      hireDate: employee.hireDate,
      terminationDate: employee.terminationDate,
      addressLine1: employee.addressLine1,
      addressLine2: employee.addressLine2,
      city: employee.city,
      stateOrRegion: employee.stateOrRegion,
      postalCode: employee.postalCode,
      countryCode: employee.countryCode,
      emergencyContactName: employee.emergencyContactName,
      emergencyContactPhone: employee.emergencyContactPhone,
      emergencyContactRelationship: employee.emergencyContactRelationship
    };
  }

  async updateEmployeeProfile(
    principal: AuthenticatedPrincipal,
    companyId: string,
    employeeId: string,
    input: {
      phone?: string | null;
      email?: string | null;
      title?: string | null;
      department?: string | null;
      hireDate?: string | null;
      terminationDate?: string | null;
      addressLine1?: string | null;
      addressLine2?: string | null;
      city?: string | null;
      stateOrRegion?: string | null;
      postalCode?: string | null;
      countryCode?: string | null;
      emergencyContactName?: string | null;
      emergencyContactPhone?: string | null;
      emergencyContactRelationship?: string | null;
    }
  ) {
    // Verify employee belongs to the company
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId }
    });
    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, companyId);

    // Build update data, only including fields that were explicitly provided
    const updateData: Prisma.EmployeeUpdateInput = {};

    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.department !== undefined) updateData.department = input.department;
    if (input.addressLine1 !== undefined) updateData.addressLine1 = input.addressLine1;
    if (input.addressLine2 !== undefined) updateData.addressLine2 = input.addressLine2;
    if (input.city !== undefined) updateData.city = input.city;
    if (input.stateOrRegion !== undefined) updateData.stateOrRegion = input.stateOrRegion;
    if (input.postalCode !== undefined) updateData.postalCode = input.postalCode;
    if (input.countryCode !== undefined) updateData.countryCode = input.countryCode;
    if (input.emergencyContactName !== undefined) updateData.emergencyContactName = input.emergencyContactName;
    if (input.emergencyContactPhone !== undefined) updateData.emergencyContactPhone = input.emergencyContactPhone;
    if (input.emergencyContactRelationship !== undefined) updateData.emergencyContactRelationship = input.emergencyContactRelationship;

    // Handle date fields - convert string to Date or null
    if (input.hireDate !== undefined) {
      updateData.hireDate = input.hireDate ? new Date(input.hireDate) : null;
    }
    if (input.terminationDate !== undefined) {
      updateData.terminationDate = input.terminationDate ? new Date(input.terminationDate) : null;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: updateData
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "EMPLOYEE_PROFILE_UPDATED",
          targetType: "Employee",
          targetId: employeeId,
          groupId: employee.groupId,
          companyId: employee.companyId,
          metadata: {
            updatedFields: Object.keys(input).filter(k => input[k as keyof typeof input] !== undefined)
          }
        }
      ]);

      return updated;
    });
  }

  async unarchiveEmployee(principal: AuthenticatedPrincipal, employeeId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, employee.companyId);

    if (!employee.archivedAt) {
      throw new BadRequestException("Employee is already active.");
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: { archivedAt: null }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "EMPLOYEE_UNARCHIVED",
          targetType: "Employee",
          targetId: employeeId,
          groupId: employee.groupId,
          companyId: employee.companyId,
          metadata: {}
        }
      ]);

      return updated;
    });
  }

  async archiveEmployee(principal: AuthenticatedPrincipal, employeeId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, employee.companyId);

    return this.prisma.$transaction(async (tx) => {
      const archivedAt = new Date();
      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: { archivedAt }
      });

      await tx.employeePinCredential.updateMany({
        where: {
          employeeId,
          revokedAt: null
        },
        data: {
          revokedAt: archivedAt
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "EMPLOYEE_ARCHIVED",
          targetType: "Employee",
          targetId: employeeId,
          groupId: employee.groupId,
          companyId: employee.companyId,
          metadata: { archivedAt: archivedAt.toISOString() }
        }
      ]);

      return updated;
    });
  }

  async regenerateEmployeePin(
    principal: AuthenticatedPrincipal,
    employeeId: string,
    input: { pin: string }
  ) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, employee.companyId);
    this.validatePin(input.pin);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${employee.companyId}));
      `;

      await this.ensurePinUniqueInCompany(tx, employee.companyId, input.pin, employee.id);

      const pinHash = await this.hashPin(input.pin);
      const now = new Date();

      await tx.employeePinCredential.updateMany({
        where: {
          employeeId,
          revokedAt: null
        },
        data: {
          revokedAt: now
        }
      });

      const created = await tx.employeePinCredential.create({
        data: {
          employeeId,
          companyId: employee.companyId,
          pinHash,
          createdByUserId: principal.userId
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "EMPLOYEE_PIN_REGENERATED",
          targetType: "EmployeePinCredential",
          targetId: created.id,
          groupId: employee.groupId,
          companyId: employee.companyId,
          metadata: { employeeId }
        }
      ]);

      return { ok: true };
    });
  }

  async addEmployeeRate(
    principal: AuthenticatedPrincipal,
    employeeId: string,
    input: EffectiveRateInput
  ) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, employee.companyId);

    const period = this.validateRatePeriod(input.effectiveStart, input.effectiveEnd);
    this.validateRateAmount(input.rateMinorUnits);

    await this.ensureEmployeeRatePeriodNoOverlap(employeeId, period.start, period.end);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.employeeRate.create({
        data: {
          employeeId,
          companyId: employee.companyId,
          rateMinorUnits: input.rateMinorUnits,
          currencyCode: "USD",
          effectiveStart: period.start,
          ...(period.end ? { effectiveEnd: period.end } : {}),
          createdByUserId: principal.userId
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "EMPLOYEE_RATE_SET",
          targetType: "EmployeeRate",
          targetId: created.id,
          groupId: employee.groupId,
          companyId: employee.companyId,
          metadata: {
            employeeId,
            rateMinorUnits: input.rateMinorUnits,
            effectiveStart: period.start.toISOString(),
            effectiveEnd: period.end?.toISOString() ?? null
          }
        }
      ]);

      return created;
    });
  }

  async listEmployeeRates(principal: AuthenticatedPrincipal, employeeId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }
    await this.companyScopeService.requireManagementCompany(principal, employee.companyId);

    return this.prisma.employeeRate.findMany({
      where: {
        employeeId,
        companyId: employee.companyId
      },
      orderBy: { effectiveStart: "asc" }
    });
  }

  async assignSupervisorToLocation(
    principal: AuthenticatedPrincipal,
    locationId: string,
    input: { supervisorUserId: string }
  ) {
    const location = await this.prisma.location.findUnique({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException("Location not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, location.companyId);

    const supervisorMembership = await this.prisma.companyMembership.findFirst({
      where: {
        companyId: location.companyId,
        userId: input.supervisorUserId,
        role: CompanyRole.SUPERVISOR,
        status: MembershipStatus.ACTIVE
      },
      select: { id: true }
    });

    if (!supervisorMembership) {
      throw new BadRequestException("Supervisor must be an active supervisor in this company.");
    }

    const existing = await this.prisma.supervisorLocationAssignment.findFirst({
      where: {
        locationId,
        supervisorUserId: input.supervisorUserId,
        unassignedAt: null
      },
      select: { id: true }
    });

    if (existing) {
      throw new BadRequestException("Supervisor is already assigned to this location.");
    }

    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.supervisorLocationAssignment.create({
        data: {
          groupId: location.groupId,
          companyId: location.companyId,
          locationId,
          supervisorUserId: input.supervisorUserId,
          assignedByUserId: principal.userId
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "SUPERVISOR_LOCATION_ASSIGNED",
          targetType: "SupervisorLocationAssignment",
          targetId: assignment.id,
          groupId: location.groupId,
          companyId: location.companyId,
          metadata: {
            locationId,
            supervisorUserId: input.supervisorUserId
          }
        }
      ]);

      return assignment;
    });
  }

  async unassignSupervisor(principal: AuthenticatedPrincipal, assignmentId: string) {
    const assignment = await this.prisma.supervisorLocationAssignment.findUnique({
      where: { id: assignmentId }
    });

    if (!assignment) {
      throw new NotFoundException("Supervisor assignment not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, assignment.companyId);

    return this.prisma.$transaction(async (tx) => {
      const unassignedAt = new Date();
      const updated = await tx.supervisorLocationAssignment.update({
        where: { id: assignmentId },
        data: { unassignedAt }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "SUPERVISOR_LOCATION_UNASSIGNED",
          targetType: "SupervisorLocationAssignment",
          targetId: assignmentId,
          groupId: assignment.groupId,
          companyId: assignment.companyId,
          metadata: { unassignedAt: unassignedAt.toISOString() }
        }
      ]);

      return updated;
    });
  }

  async getCompanyAccessContext(principal: AuthenticatedPrincipal, companyId: string) {
    const context = await this.companyScopeService.getCompanyAccessContext(principal, companyId);
    return {
      companyId: context.company.id,
      accessLevel: context.accessLevel,
      unrestrictedLocations: context.unrestrictedLocations,
      allowedLocationIds: context.allowedLocationIds,
      canManageCompany: context.canManageCompany,
      canAccessWeeklyClose: context.canAccessWeeklyClose,
      canAccessKioskAdmin: context.canAccessKioskAdmin
    };
  }

  async getCompanyProfile(principal: AuthenticatedPrincipal, companyId: string) {
    await this.companyScopeService.getCompanyAccessContext(principal, companyId);

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: this.companyProfileSelect()
    });

    if (!company) {
      throw new NotFoundException("Company not found.");
    }

    return this.mapCompanyProfile(company);
  }

  async updateCompanyProfile(
    principal: AuthenticatedPrincipal,
    companyId: string,
    input: CompanyProfileUpdateInput
  ) {
    await this.companyScopeService.requireManagementCompany(principal, companyId);

    const data = buildCompanyProfileUpdateData(input);

    const company = await this.prisma.company.update({
      where: { id: companyId },
      data,
      select: this.companyProfileSelect()
    });

    return this.mapCompanyProfile(company);
  }

  private companyProfileSelect() {
    return {
      id: true,
      name: true,
      currencyCode: true,
      legalName: true,
      phone: true,
      billingEmail: true,
      primaryContactName: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      stateRegion: true,
      postalCode: true,
      country: true
    } as const;
  }

  private mapCompanyProfile(company: {
    id: string;
    name: string;
    currencyCode: string;
    legalName: string | null;
    phone: string | null;
    billingEmail: string | null;
    primaryContactName: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    stateRegion: string | null;
    postalCode: string | null;
    country: string | null;
  }) {
    return {
      companyId: company.id,
      name: company.name,
      currencyCode: company.currencyCode,
      legalName: company.legalName,
      phone: company.phone,
      billingEmail: company.billingEmail,
      primaryContactName: company.primaryContactName,
      addressLine1: company.addressLine1,
      addressLine2: company.addressLine2,
      city: company.city,
      stateRegion: company.stateRegion,
      postalCode: company.postalCode,
      country: company.country
    };
  }

  async listLocationSupervisors(principal: AuthenticatedPrincipal, locationId: string) {
    const location = await this.prisma.location.findUnique({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException("Location not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, location.companyId);

    return this.prisma.supervisorLocationAssignment.findMany({
      where: {
        locationId,
        unassignedAt: null
      },
      include: {
        supervisor: {
          select: {
            id: true,
            email: true,
            fullName: true
          }
        }
      },
      orderBy: { assignedAt: "asc" }
    });
  }

  async listCompanySupervisors(principal: AuthenticatedPrincipal, companyId: string) {
    await this.companyScopeService.requireManagementCompany(principal, companyId);

    const memberships = await this.prisma.companyMembership.findMany({
      where: {
        companyId,
        role: CompanyRole.SUPERVISOR,
        status: { in: [MembershipStatus.ACTIVE, MembershipStatus.INVITED] }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true
          }
        }
      },
      orderBy: { email: "asc" }
    });

    const assignmentCounts = await this.prisma.supervisorLocationAssignment.groupBy({
      by: ["supervisorUserId"],
      where: {
        companyId,
        unassignedAt: null
      },
      _count: {
        _all: true
      }
    });

    const countBySupervisor = new Map(
      assignmentCounts.map((row) => [row.supervisorUserId, row._count._all])
    );

    return memberships.map((membership) => {
      const user = membership.user;
      const isInvited = membership.status === MembershipStatus.INVITED;

      return {
        userId: user?.id ?? null,
        email: membership.email,
        fullName: user?.fullName ?? null,
        role: CompanyRole.SUPERVISOR,
        status: isInvited ? ("INVITED" as const) : ("ACTIVE" as const),
        assignedLocationCount: user ? (countBySupervisor.get(user.id) ?? 0) : 0
      };
    });
  }

  async listCompanySupervisorLocationAssignments(
    principal: AuthenticatedPrincipal,
    companyId: string
  ) {
    await this.companyScopeService.requireManagementCompany(principal, companyId);

    const assignments = await this.prisma.supervisorLocationAssignment.findMany({
      where: {
        companyId,
        unassignedAt: null
      },
      include: {
        supervisor: {
          select: {
            id: true,
            email: true,
            fullName: true
          }
        },
        location: {
          select: {
            id: true,
            name: true,
            timezone: true,
            archivedAt: true
          }
        }
      },
      orderBy: [{ assignedAt: "asc" }]
    });

    return assignments.map((assignment) => ({
      id: assignment.id,
      companyId: assignment.companyId,
      supervisorUserId: assignment.supervisorUserId,
      locationId: assignment.locationId,
      assignedAt: assignment.assignedAt,
      supervisor: assignment.supervisor,
      location: assignment.location
    }));
  }

  async assignSupervisorToCompanyLocation(
    principal: AuthenticatedPrincipal,
    companyId: string,
    supervisorUserId: string,
    locationId: string
  ) {
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        companyId
      }
    });

    if (!location) {
      throw new NotFoundException("Location not found in this company.");
    }

    return this.assignSupervisorToLocation(principal, locationId, { supervisorUserId });
  }

  async removeSupervisorFromCompanyLocation(
    principal: AuthenticatedPrincipal,
    companyId: string,
    supervisorUserId: string,
    locationId: string
  ) {
    await this.companyScopeService.requireManagementCompany(principal, companyId);

    const assignment = await this.prisma.supervisorLocationAssignment.findFirst({
      where: {
        companyId,
        supervisorUserId,
        locationId,
        unassignedAt: null
      }
    });

    if (!assignment) {
      throw new NotFoundException("Supervisor location assignment not found.");
    }

    return this.unassignSupervisor(principal, assignment.id);
  }

  async bulkRemoveSupervisorFromCompanyLocations(
    principal: AuthenticatedPrincipal,
    companyId: string,
    supervisorUserId: string,
    locationIds: string[]
  ) {
    await this.companyScopeService.requireManagementCompany(principal, companyId);

    const uniqueLocationIds = [...new Set(locationIds)];
    if (uniqueLocationIds.length === 0) {
      throw new BadRequestException("Selecciona al menos una ubicación.");
    }

    const assignments = await this.prisma.supervisorLocationAssignment.findMany({
      where: {
        companyId,
        supervisorUserId,
        locationId: { in: uniqueLocationIds },
        unassignedAt: null
      }
    });

    if (assignments.length === 0) {
      throw new NotFoundException("No active location assignments found for this supervisor.");
    }

    return this.prisma.$transaction(async (tx) => {
      const unassignedAt = new Date();

      await tx.supervisorLocationAssignment.updateMany({
        where: { id: { in: assignments.map((assignment) => assignment.id) } },
        data: { unassignedAt }
      });

      await this.createAuditEvents(
        tx,
        assignments.map((assignment) => ({
          actorUserId: principal.userId,
          action: "SUPERVISOR_LOCATION_UNASSIGNED",
          targetType: "SupervisorLocationAssignment",
          targetId: assignment.id,
          groupId: assignment.groupId,
          companyId: assignment.companyId,
          metadata: {
            unassignedAt: unassignedAt.toISOString(),
            bulk: true,
            bulkCount: assignments.length
          }
        }))
      );

      return { removedCount: assignments.length };
    });
  }

  async listCompanyMembers(principal: AuthenticatedPrincipal, companyId: string) {
    await this.companyScopeService.requireManagementCompany(principal, companyId);

    const memberships = await this.prisma.companyMembership.findMany({
      where: {
        companyId,
        role: { in: [CompanyRole.COMPANY_ADMIN, CompanyRole.SUPERVISOR] },
        status: MembershipStatus.ACTIVE
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } }
      },
      orderBy: [{ role: "asc" }, { email: "asc" }]
    });

    const assignmentCounts = await this.prisma.supervisorLocationAssignment.groupBy({
      by: ["supervisorUserId"],
      where: { companyId, unassignedAt: null },
      _count: { _all: true }
    });
    const countBySupervisor = new Map(
      assignmentCounts.map((row) => [row.supervisorUserId, row._count._all])
    );

    return memberships.map((membership) => ({
      membershipId: membership.id,
      userId: membership.user?.id ?? null,
      email: membership.email,
      fullName: membership.user?.fullName ?? null,
      role: membership.role,
      assignedLocationCount:
        membership.role === CompanyRole.SUPERVISOR && membership.user
          ? (countBySupervisor.get(membership.user.id) ?? 0)
          : null
    }));
  }

  private async countOtherActiveCompanyAdmins(companyId: string, excludeMembershipId: string) {
    return this.prisma.companyMembership.count({
      where: {
        companyId,
        role: CompanyRole.COMPANY_ADMIN,
        status: MembershipStatus.ACTIVE,
        id: { not: excludeMembershipId }
      }
    });
  }

  async revokeCompanyMembership(
    principal: AuthenticatedPrincipal,
    companyId: string,
    membershipId: string
  ) {
    const company = await this.companyScopeService.requireManagementCompany(principal, companyId);

    const membership = await this.prisma.companyMembership.findFirst({
      where: { id: membershipId, companyId, status: MembershipStatus.ACTIVE }
    });

    if (!membership) {
      throw new NotFoundException("Active membership not found.");
    }

    if (membership.userId && membership.userId === principal.userId) {
      throw new BadRequestException("No puedes revocar tu propio acceso.");
    }

    if (membership.role === CompanyRole.COMPANY_ADMIN) {
      const remainingAdmins = await this.countOtherActiveCompanyAdmins(companyId, membershipId);
      if (remainingAdmins === 0) {
        throw new BadRequestException(
          "No puedes revocar al único administrador activo de la compañía."
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const revokedAt = new Date();
      const updated = await tx.companyMembership.update({
        where: { id: membershipId },
        data: { status: MembershipStatus.REVOKED }
      });

      if (membership.role === CompanyRole.SUPERVISOR && membership.userId) {
        await tx.supervisorLocationAssignment.updateMany({
          where: { companyId, supervisorUserId: membership.userId, unassignedAt: null },
          data: { unassignedAt: revokedAt }
        });
      }

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "COMPANY_MEMBERSHIP_REVOKED",
          targetType: "CompanyMembership",
          targetId: membershipId,
          groupId: company.groupId,
          companyId,
          metadata: {
            email: membership.email,
            role: membership.role,
            revokedUserId: membership.userId
          }
        }
      ]);

      return updated;
    });
  }

  async updateCompanyMembershipRole(
    principal: AuthenticatedPrincipal,
    companyId: string,
    membershipId: string,
    newRole: CompanyRole
  ) {
    const company = await this.companyScopeService.requireManagementCompany(principal, companyId);

    const membership = await this.prisma.companyMembership.findFirst({
      where: { id: membershipId, companyId, status: MembershipStatus.ACTIVE }
    });

    if (!membership) {
      throw new NotFoundException("Active membership not found.");
    }

    if (membership.role === newRole) {
      return membership;
    }

    if (membership.role === CompanyRole.COMPANY_ADMIN && newRole === CompanyRole.SUPERVISOR) {
      const remainingAdmins = await this.countOtherActiveCompanyAdmins(companyId, membershipId);
      if (remainingAdmins === 0) {
        throw new BadRequestException(
          "No puedes quitarle el rol de administrador al único administrador activo de la compañía."
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.companyMembership.update({
        where: { id: membershipId },
        data: { role: newRole }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "COMPANY_MEMBERSHIP_ROLE_CHANGED",
          targetType: "CompanyMembership",
          targetId: membershipId,
          groupId: company.groupId,
          companyId,
          metadata: {
            email: membership.email,
            previousRole: membership.role,
            newRole
          }
        }
      ]);

      return updated;
    });
  }

  async listShifts(
    principal: AuthenticatedPrincipal,
    companyId: string,
    options: ListShiftsOptions
  ) {
    const access = await this.companyScopeService.getCompanyAccessContext(principal, companyId);
    await this.companyScopeService.assertLocationFilterAllowed(principal, companyId, options.locationId);

    if (options.locationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: options.locationId, companyId },
        select: { id: true }
      });
      if (!location) {
        throw new BadRequestException("Location must belong to the selected company.");
      }
    }

    if (options.employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: options.employeeId, companyId },
        select: { id: true }
      });
      if (!employee) {
        throw new BadRequestException("Employee must belong to the selected company.");
      }
    }

    const from = options.from ? this.parseShiftInstant(options.from, "from") : null;
    const to = options.to ? this.parseShiftInstant(options.to, "to") : null;

    if (from && to && to <= from) {
      throw new BadRequestException("to must be after from.");
    }

    const locationScope = this.companyScopeService.buildLocationIdFilter(access, options.locationId);

    const statusFilter = options.includeCancelled
      ? { status: { in: [ShiftStatus.SCHEDULED, ShiftStatus.CANCELLED] } }
      : { status: ShiftStatus.SCHEDULED };

    return this.prisma.shift.findMany({
      where: {
        companyId,
        ...statusFilter,
        ...locationScope,
        ...(options.employeeId ? { employeeId: options.employeeId } : {}),
        ...(from ? { scheduledStartUtc: { gte: from } } : {}),
        ...(to ? { scheduledStartUtc: { lt: to } } : {})
      },
      include: {
        employee: { select: { id: true, fullName: true } },
        location: { select: { id: true, name: true, timezone: true, serviceClientId: true } },
        serviceClient: { select: { id: true, name: true } },
        punchEvents: {
          select: { id: true, action: true, eventUtc: true, isLate: true, isEarly: true },
          orderBy: { eventUtc: "asc" }
        }
      },
      orderBy: { scheduledStartUtc: "asc" }
    });
  }

  async getShift(principal: AuthenticatedPrincipal, shiftId: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        employee: { select: { id: true, fullName: true } },
        location: { select: { id: true, name: true, timezone: true, serviceClientId: true } },
        serviceClient: { select: { id: true, name: true } }
      }
    });

    if (!shift) {
      throw new NotFoundException("Shift not found.");
    }

    await this.companyScopeService.requireShiftLocationAccess(principal, shift);
    return shift;
  }

  async createShift(
    principal: AuthenticatedPrincipal,
    companyId: string,
    input: CreateShiftInput
  ) {
    const company = await this.companyScopeService.requireManagementCompany(principal, companyId);

    const employeeId = input.employeeId?.trim() ?? "";
    const serviceClientId = input.serviceClientId?.trim() ?? "";
    const locationId = input.locationId?.trim() ?? "";

    if (!employeeId) {
      throw new BadRequestException("Employee is required.");
    }

    if (!serviceClientId) {
      throw new BadRequestException("Service client is required.");
    }

    if (!locationId) {
      throw new BadRequestException("Location is required.");
    }

    const scheduledStartUtc = this.parseShiftInstant(input.scheduledStartUtc, "scheduledStartUtc");
    const scheduledEndUtc = this.parseShiftInstant(input.scheduledEndUtc, "scheduledEndUtc");

    if (scheduledEndUtc <= scheduledStartUtc) {
      throw new BadRequestException("scheduledEndUtc must be after scheduledStartUtc.");
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId, archivedAt: null }
    });
    if (!employee) {
      throw new BadRequestException("Employee must exist, be active, and belong to the same company.");
    }

    const serviceClient = await this.prisma.serviceClient.findFirst({
      where: { id: serviceClientId, companyId, archivedAt: null }
    });
    if (!serviceClient) {
      throw new BadRequestException(
        "Service client must exist, be active, and belong to the same company."
      );
    }

    const location = await this.prisma.location.findFirst({
      where: { id: locationId, companyId, archivedAt: null },
      include: { serviceClientLinks: { select: { serviceClientId: true } } }
    });
    if (!location) {
      throw new BadRequestException("Location must exist, be active, and belong to the same company.");
    }

    if (
      !isLocationLinkedToServiceClient({
        locationServiceClientId: location.serviceClientId,
        serviceClientId,
        linkedServiceClientIds: location.serviceClientLinks.map((link) => link.serviceClientId)
      })
    ) {
      throw new BadRequestException("Location must belong to the selected service client.");
    }

    await this.ensureShiftNoOverlap({
      companyId,
      employeeId,
      scheduledStartUtc,
      scheduledEndUtc
    });

    return this.prisma.$transaction(async (tx) => {
      const shift = await tx.shift.create({
        data: {
          groupId: company.groupId,
          companyId,
          locationId: location.id,
          employeeId: employee.id,
          serviceClientId: serviceClient.id,
          status: ShiftStatus.SCHEDULED,
          scheduledStartUtc,
          scheduledEndUtc,
          timezone: location.timezone
        },
        include: {
          employee: { select: { id: true, fullName: true } },
          location: { select: { id: true, name: true, timezone: true, serviceClientId: true } },
          serviceClient: { select: { id: true, name: true } }
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "SHIFT_CREATED",
          targetType: "Shift",
          targetId: shift.id,
          groupId: company.groupId,
          companyId,
          metadata: {
            employeeId: employee.id,
            serviceClientId: serviceClient.id,
            locationId: location.id,
            scheduledStartUtc: scheduledStartUtc.toISOString(),
            scheduledEndUtc: scheduledEndUtc.toISOString(),
            timezone: location.timezone
          }
        }
      ]);

      return shift;
    });
  }

  async updateShift(principal: AuthenticatedPrincipal, shiftId: string, input: UpdateShiftInput) {
    const existing = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        punchEvents: { select: { id: true }, take: 1 },
        employee: { select: { id: true, fullName: true } },
        location: { select: { id: true, name: true, timezone: true, serviceClientId: true } },
        serviceClient: { select: { id: true, name: true } }
      }
    });

    if (!existing) {
      throw new NotFoundException("Shift not found.");
    }

    const company = await this.companyScopeService.requireManagementCompany(
      principal,
      existing.companyId
    );

    assertShiftMutableForScheduling(existing);
    await this.weeklyPeriodLockService.assertWeekOpenForShift(existing);

    const scheduledStartUtc = this.parseShiftInstant(input.scheduledStartUtc, "scheduledStartUtc");
    const scheduledEndUtc = this.parseShiftInstant(input.scheduledEndUtc, "scheduledEndUtc");

    if (scheduledEndUtc <= scheduledStartUtc) {
      throw new BadRequestException("scheduledEndUtc must be after scheduledStartUtc.");
    }

    const employeeId = (input.employeeId?.trim() || existing.employeeId) ?? existing.employeeId;

    if (employeeId !== existing.employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: employeeId, companyId: existing.companyId, archivedAt: null }
      });
      if (!employee) {
        throw new BadRequestException("Employee must exist, be active, and belong to the same company.");
      }
    }

    const overlap = await this.findShiftOverlap({
      companyId: existing.companyId,
      employeeId,
      scheduledStartUtc,
      scheduledEndUtc,
      excludeShiftId: existing.id
    });

    if (overlap) {
      throw new BadRequestException({
        message: "This employee already has a shift during that time.",
        conflicts: [toShiftScheduleConflict(overlap, "overlapping_shift")]
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const shift = await tx.shift.update({
        where: { id: existing.id },
        data: {
          employeeId,
          scheduledStartUtc,
          scheduledEndUtc
        },
        include: {
          employee: { select: { id: true, fullName: true } },
          location: { select: { id: true, name: true, timezone: true, serviceClientId: true } },
          serviceClient: { select: { id: true, name: true } }
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "SHIFT_UPDATED",
          targetType: "Shift",
          targetId: shift.id,
          groupId: company.groupId,
          companyId: existing.companyId,
          metadata: {
            before: {
              employeeId: existing.employeeId,
              scheduledStartUtc: existing.scheduledStartUtc.toISOString(),
              scheduledEndUtc: existing.scheduledEndUtc.toISOString()
            },
            after: {
              employeeId: shift.employeeId,
              scheduledStartUtc: scheduledStartUtc.toISOString(),
              scheduledEndUtc: scheduledEndUtc.toISOString()
            }
          }
        }
      ]);

      return shift;
    });
  }

  async cancelShift(principal: AuthenticatedPrincipal, shiftId: string, input: CancelShiftInput) {
    const existing = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        punchEvents: { select: { id: true }, take: 1 },
        employee: { select: { id: true, fullName: true } },
        location: { select: { id: true, name: true } },
        serviceClient: { select: { id: true, name: true } }
      }
    });

    if (!existing) {
      throw new NotFoundException("Shift not found.");
    }

    const company = await this.companyScopeService.requireManagementCompany(
      principal,
      existing.companyId
    );

    const cancelReason = input.cancelReason?.trim() ?? "";
    if (!cancelReason) {
      throw new BadRequestException("Cancel reason is required.");
    }

    assertShiftMutableForScheduling(existing);
    await this.weeklyPeriodLockService.assertWeekOpenForShift(existing);

    const cancelledAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      const shift = await tx.shift.update({
        where: { id: existing.id },
        data: {
          status: ShiftStatus.CANCELLED,
          cancelledAt,
          cancelledByUserId: principal.userId,
          cancelReason
        },
        include: {
          employee: { select: { id: true, fullName: true } },
          location: { select: { id: true, name: true, timezone: true, serviceClientId: true } },
          serviceClient: { select: { id: true, name: true } }
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "SHIFT_CANCELLED",
          targetType: "Shift",
          targetId: shift.id,
          groupId: company.groupId,
          companyId: existing.companyId,
          metadata: {
            cancelReason,
            scheduledStartUtc: existing.scheduledStartUtc.toISOString(),
            scheduledEndUtc: existing.scheduledEndUtc.toISOString()
          }
        }
      ]);

      return shift;
    });
  }

  async copyWeekShifts(
    principal: AuthenticatedPrincipal,
    companyId: string,
    input: CopyWeekInput
  ): Promise<CopyWeekResult> {
    const company = await this.companyScopeService.requireManagementCompany(principal, companyId);

    const sourceWeekStart = parseWeekStartDateKey(input.sourceWeekStart, "sourceWeekStart");
    const targetWeekStart = parseWeekStartDateKey(input.targetWeekStart, "targetWeekStart");

    if (sourceWeekStart === targetWeekStart) {
      throw new BadRequestException("targetWeekStart must differ from sourceWeekStart.");
    }

    const locations = await this.prisma.location.findMany({
      where: { companyId, archivedAt: null },
      select: { id: true, timezone: true, archivedAt: true }
    });

    const filterTimeZone = input.locationId
      ? (locations.find((location) => location.id === input.locationId)?.timezone ?? DEFAULT_TIMEZONE)
      : resolveCompanyCloseTimeZone(locations);

    if (input.locationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: input.locationId, companyId },
        select: { id: true }
      });
      if (!location) {
        throw new BadRequestException("Location must belong to the selected company.");
      }
    }

    if (input.employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: input.employeeId, companyId },
        select: { id: true }
      });
      if (!employee) {
        throw new BadRequestException("Employee must belong to the selected company.");
      }
    }

    if (input.serviceClientId) {
      const serviceClient = await this.prisma.serviceClient.findFirst({
        where: { id: input.serviceClientId, companyId },
        select: { id: true }
      });
      if (!serviceClient) {
        throw new BadRequestException("Service client must belong to the selected company.");
      }
    }

    const operationKey = buildCopyWeekOperationKey({
      companyId,
      sourceWeekStart,
      targetWeekStart,
      locationId: input.locationId,
      employeeId: input.employeeId,
      serviceClientId: input.serviceClientId
    });

    const existingBatch = await this.prisma.shiftGenerationBatch.findUnique({
      where: { operationKey },
      include: {
        shifts: {
          include: {
            employee: { select: { id: true, fullName: true } }
          }
        }
      }
    });

    if (existingBatch) {
      return this.buildCopyWeekResultFromBatch(existingBatch.id, existingBatch.shifts, [], []);
    }

    const { from, to } = weekRangeToUtcBounds(sourceWeekStart, filterTimeZone);

    const sourceShifts = await this.prisma.shift.findMany({
      where: {
        companyId,
        status: ShiftStatus.SCHEDULED,
        cancelledAt: null,
        scheduledStartUtc: { gte: new Date(from), lt: new Date(to) },
        ...(input.locationId ? { locationId: input.locationId } : {}),
        ...(input.employeeId ? { employeeId: input.employeeId } : {}),
        ...(input.serviceClientId ? { serviceClientId: input.serviceClientId } : {})
      },
      include: {
        employee: { select: { id: true, fullName: true, archivedAt: true } },
        location: { select: { id: true, name: true, archivedAt: true } },
        serviceClient: { select: { id: true, name: true, archivedAt: true } }
      },
      orderBy: { scheduledStartUtc: "asc" }
    });

    const created: CopyWeekResult["created"] = [];
    const skipped: CopyWeekResult["skipped"] = [];
    const conflicts: CopyWeekResult["conflicts"] = [];

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.shiftGenerationBatch.create({
        data: {
          groupId: company.groupId,
          companyId,
          operationType: ShiftBatchType.COPY_WEEK,
          operationKey,
          sourceWeekStartUtc: new Date(from),
          targetWeekStartUtc: new Date(weekRangeToUtcBounds(targetWeekStart, filterTimeZone).from),
          createdByUserId: principal.userId
        }
      });

      for (const sourceShift of sourceShifts) {
        if (sourceShift.employee.archivedAt) {
          skipped.push({ sourceShiftId: sourceShift.id, reason: "employee_archived" });
          continue;
        }

        if (sourceShift.location.archivedAt) {
          skipped.push({ sourceShiftId: sourceShift.id, reason: "location_archived" });
          continue;
        }

        if (sourceShift.serviceClient.archivedAt) {
          skipped.push({ sourceShiftId: sourceShift.id, reason: "service_client_archived" });
          continue;
        }

        const planningKey = buildCopyWeekPlanningKey(operationKey, sourceShift.id);
        const existingPlanned = await tx.shift.findUnique({
          where: { planningKey },
          select: { id: true }
        });

        if (existingPlanned) {
          skipped.push({ sourceShiftId: sourceShift.id, reason: "already_copied" });
          continue;
        }

        const targetTimes = mapShiftToTargetWeek(sourceShift, sourceWeekStart, targetWeekStart);

        if (targetTimes.scheduledEndUtc <= targetTimes.scheduledStartUtc) {
          skipped.push({ sourceShiftId: sourceShift.id, reason: "invalid_target_schedule" });
          continue;
        }

        const overlap = await tx.shift.findFirst({
          where: buildShiftOverlapWhere({
            companyId,
            employeeId: sourceShift.employeeId,
            scheduledStartUtc: targetTimes.scheduledStartUtc,
            scheduledEndUtc: targetTimes.scheduledEndUtc
          }),
          include: {
            employee: { select: { fullName: true } },
            location: { select: { name: true } }
          }
        });

        if (overlap) {
          conflicts.push(toShiftScheduleConflict(overlap, "overlapping_shift"));
          continue;
        }

        try {
          const shift = await tx.shift.create({
            data: {
              groupId: company.groupId,
              companyId,
              locationId: sourceShift.locationId,
              employeeId: sourceShift.employeeId,
              serviceClientId: sourceShift.serviceClientId,
              status: ShiftStatus.SCHEDULED,
              scheduledStartUtc: targetTimes.scheduledStartUtc,
              scheduledEndUtc: targetTimes.scheduledEndUtc,
              timezone: sourceShift.timezone,
              generationBatchId: batch.id,
              planningKey
            },
            include: {
              employee: { select: { id: true, fullName: true } }
            }
          });

          created.push({
            shiftId: shift.id,
            employeeId: shift.employeeId,
            employeeName: shift.employee.fullName,
            scheduledStartUtc: shift.scheduledStartUtc.toISOString(),
            scheduledEndUtc: shift.scheduledEndUtc.toISOString()
          });
        } catch {
          conflicts.push({
            employeeId: sourceShift.employeeId,
            employeeName: sourceShift.employee.fullName,
            conflictingShiftId: sourceShift.id,
            scheduledStart: targetTimes.scheduledStartUtc.toISOString(),
            scheduledEnd: targetTimes.scheduledEndUtc.toISOString(),
            locationName: sourceShift.location.name,
            reason: "overlap_constraint"
          });
        }
      }

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "SHIFT_WEEK_COPIED",
          targetType: "ShiftGenerationBatch",
          targetId: batch.id,
          groupId: company.groupId,
          companyId,
          metadata: {
            sourceWeekStart,
            targetWeekStart,
            createdCount: created.length,
            skippedCount: skipped.length,
            conflictCount: conflicts.length
          }
        }
      ]);

      return this.buildCopyWeekResultFromBatch(batch.id, [], created, skipped, conflicts);
    });
  }

  private buildCopyWeekResultFromBatch(
    batchId: string,
    existingShifts: Array<{
      id: string;
      employeeId: string;
      scheduledStartUtc: Date;
      scheduledEndUtc: Date;
      employee?: { fullName: string } | null;
    }>,
    created: CopyWeekResult["created"],
    skipped: CopyWeekResult["skipped"],
    conflicts: CopyWeekResult["conflicts"] = []
  ): CopyWeekResult {
    const createdEntries =
      created.length > 0
        ? created
        : existingShifts.map((shift) => ({
            shiftId: shift.id,
            employeeId: shift.employeeId,
            employeeName: shift.employee?.fullName ?? null,
            scheduledStartUtc: shift.scheduledStartUtc.toISOString(),
            scheduledEndUtc: shift.scheduledEndUtc.toISOString()
          }));

    return {
      batchId,
      created: createdEntries,
      skipped,
      conflicts,
      summary: {
        createdCount: createdEntries.length,
        skippedCount: skipped.length,
        conflictCount: conflicts.length
      }
    };
  }

  private validateRatePeriod(effectiveStartIso: string, effectiveEndIso?: string) {
    const start = new Date(effectiveStartIso);
    const end = effectiveEndIso ? new Date(effectiveEndIso) : null;

    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException("effectiveStart must be a valid ISO date-time.");
    }

    if (end && Number.isNaN(end.getTime())) {
      throw new BadRequestException("effectiveEnd must be a valid ISO date-time when provided.");
    }

    if (end && end <= start) {
      throw new BadRequestException("effectiveEnd must be greater than effectiveStart.");
    }

    return { start, end };
  }

  private validateRateAmount(rateMinorUnits: number) {
    if (!Number.isInteger(rateMinorUnits) || rateMinorUnits <= 0) {
      throw new BadRequestException("rateMinorUnits must be a positive integer minor-unit amount.");
    }
  }

  private validatePin(pin: string) {
    if (!PIN_PATTERN.test(pin)) {
      throw new BadRequestException("Employee PIN must be exactly 6 digits.");
    }
  }

  private async hashPin(pin: string) {
    return argon2.hash(pin, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1
    });
  }

  private async ensurePinUniqueInCompany(
    tx: Prisma.TransactionClient,
    companyId: string,
    pin: string,
    employeeIdToIgnore?: string
  ) {
    const activeCredentials = await tx.employeePinCredential.findMany({
      where: {
        companyId,
        revokedAt: null,
        employee: {
          archivedAt: null
        },
        ...(employeeIdToIgnore ? { employeeId: { not: employeeIdToIgnore } } : {})
      },
      select: {
        pinHash: true
      }
    });

    for (const credential of activeCredentials) {
      const isSame = await argon2.verify(credential.pinHash, pin);
      if (isSame) {
        throw new BadRequestException("Employee PIN must be unique within the company.");
      }
    }
  }

  private async ensureEmployeeRatePeriodNoOverlap(
    employeeId: string,
    start: Date,
    end: Date | null
  ) {
    const overlappingRate = await this.prisma.employeeRate.findFirst({
      where: {
        employeeId,
        AND: this.employeeRateOverlapWhere(start, end)
      },
      select: { id: true }
    });

    if (overlappingRate) {
      throw new BadRequestException("Overlapping employee rate effective periods are not allowed.");
    }
  }

  private async ensureClientRatePeriodNoOverlap(input: {
    companyId: string;
    serviceClientId: string | null;
    locationId: string | null;
    start: Date;
    end: Date | null;
  }) {
    const overlappingRate = await this.prisma.clientLaborRate.findFirst({
      where: {
        companyId: input.companyId,
        serviceClientId: input.serviceClientId,
        locationId: input.locationId,
        AND: this.clientRateOverlapWhere(input.start, input.end)
      },
      select: { id: true }
    });

    if (overlappingRate) {
      throw new BadRequestException("Overlapping client labor rate effective periods are not allowed.");
    }
  }

  private employeeRateOverlapWhere(
    start: Date,
    end: Date | null
  ): Prisma.Enumerable<Prisma.EmployeeRateWhereInput> {
    return [
      {
        OR: [{ effectiveEnd: null }, { effectiveEnd: { gt: start } }]
      },
      ...(end ? [{ effectiveStart: { lt: end } }] : [])
    ];
  }

  private clientRateOverlapWhere(
    start: Date,
    end: Date | null
  ): Prisma.Enumerable<Prisma.ClientLaborRateWhereInput> {
    return [
      {
        OR: [{ effectiveEnd: null }, { effectiveEnd: { gt: start } }]
      },
      ...(end ? [{ effectiveStart: { lt: end } }] : [])
    ];
  }

  private parseShiftInstant(value: string, fieldName: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid ISO date-time.`);
    }

    return parsed;
  }

  private async findShiftOverlap(input: {
    companyId: string;
    employeeId: string;
    scheduledStartUtc: Date;
    scheduledEndUtc: Date;
    excludeShiftId?: string;
  }) {
    return this.prisma.shift.findFirst({
      where: buildShiftOverlapWhere(input),
      include: {
        employee: { select: { id: true, fullName: true } },
        location: { select: { id: true, name: true } }
      }
    });
  }

  private async ensureShiftNoOverlap(input: {
    companyId: string;
    employeeId: string;
    scheduledStartUtc: Date;
    scheduledEndUtc: Date;
    excludeShiftId?: string;
  }) {
    const overlapping = await this.findShiftOverlap(input);

    if (overlapping) {
      throw new BadRequestException({
        message: "This employee already has a shift during that time.",
        conflicts: [toShiftScheduleConflict(overlapping, "overlapping_shift")]
      });
    }
  }

  private isValidIanaTimeZone(timezone: string) {
    try {
      Intl.DateTimeFormat("en-US", { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  private async createAuditEvents(
    tx: Prisma.TransactionClient,
    data: Prisma.AuditEventCreateManyInput[]
  ) {
    if (data.length === 0) {
      return;
    }

    await tx.auditEvent.createMany({ data });
  }

  private normalizeOptionalText(value?: string) {
    const trimmed = value?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeCurrencyCode(value?: string) {
    const currencyCode = (value?.trim().toUpperCase() ?? "USD").slice(0, 3);
    if (!/^[A-Z]{3}$/.test(currencyCode)) {
      throw new BadRequestException("Currency code must be a 3-letter ISO code.");
    }

    return currencyCode;
  }

  private parsePositivePriceMinor(value: number) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException("Fixed service price must be a positive integer in minor units.");
    }

    return value;
  }

  private parseSortOrder(value?: number) {
    if (value === undefined) {
      return 0;
    }

    if (!Number.isInteger(value)) {
      throw new BadRequestException("Sort order must be an integer.");
    }

    return value;
  }

  private async assertServiceCatalogNameAvailable(
    companyId: string,
    name: string,
    excludeItemId?: string
  ) {
    const existing = await this.prisma.serviceCatalogItem.findFirst({
      where: {
        companyId,
        name,
        ...(excludeItemId ? { NOT: { id: excludeItemId } } : {})
      }
    });

    if (existing) {
      throw new BadRequestException("A service with this name already exists for the company.");
    }
  }

  private vehicleInclude() {
    return {
      serviceClient: { select: { id: true, name: true } },
      location: { select: { id: true, name: true, timezone: true, serviceClientId: true } }
    };
  }

  private async assertVehicleVinAvailable(companyId: string, vin: string) {
    const existing = await this.prisma.vehicle.findFirst({
      where: { companyId, vin }
    });

    if (existing) {
      throw new BadRequestException("A vehicle with this VIN already exists for the company.");
    }
  }

  private async resolveVehicleClientLocation(
    companyId: string,
    serviceClientId: string,
    locationId: string
  ) {
    const clientId = serviceClientId?.trim() ?? "";
    const locId = locationId?.trim() ?? "";

    if (!clientId) {
      throw new BadRequestException("Service client is required.");
    }

    if (!locId) {
      throw new BadRequestException("Location is required.");
    }

    const serviceClient = await this.prisma.serviceClient.findFirst({
      where: { id: clientId, companyId, archivedAt: null }
    });

    if (!serviceClient) {
      throw new BadRequestException("Service client not found for this company.");
    }

    const location = await this.prisma.location.findFirst({
      where: { id: locId, companyId, archivedAt: null },
      include: { serviceClientLinks: { select: { serviceClientId: true } } }
    });

    if (!location) {
      throw new BadRequestException("Location not found for this company.");
    }

    if (
      !isLocationLinkedToServiceClient({
        locationServiceClientId: location.serviceClientId,
        serviceClientId: serviceClient.id,
        linkedServiceClientIds: location.serviceClientLinks.map((link) => link.serviceClientId)
      })
    ) {
      throw new BadRequestException("Location does not belong to the selected service client.");
    }

    return { serviceClient, location };
  }

  private parseOptionalNonNegativeMileage(value: number | undefined, allowNull = false) {
    if (value === undefined) {
      return allowNull ? undefined : null;
    }

    if (value === null) {
      return null;
    }

    if (!Number.isInteger(value) || value < 0) {
      throw new BadRequestException("Mileage must be a non-negative integer.");
    }

    return value;
  }

  private workOrderInclude() {
    return {
      vehicle: {
        include: {
          serviceClient: { select: { id: true, name: true } },
          location: { select: { id: true, name: true, timezone: true, serviceClientId: true } }
        }
      },
      serviceClient: { select: { id: true, name: true } },
      location: { select: { id: true, name: true, timezone: true, serviceClientId: true } },
      serviceLines: {
        orderBy: { createdAt: "asc" as const },
        include: {
          serviceCompletions: {
            where: { voidedAt: null },
            orderBy: { completedAt: "desc" as const },
            include: {
              employee: { select: { id: true, fullName: true } }
            }
          }
        }
      },
      statusHistory: { orderBy: { createdAt: "asc" as const } },
      assignments: {
        include: {
          employee: { select: { id: true, fullName: true } },
          workOrderServiceLine: { select: { id: true, serviceNameSnapshot: true } }
        },
        orderBy: [{ assignedAt: "desc" as const }]
      },
      responsibilityLogs: {
        include: {
          employee: { select: { id: true, fullName: true } }
        },
        orderBy: [{ occurredAt: "desc" as const }]
      },
      workerScanEvents: {
        include: {
          employee: { select: { id: true, fullName: true } }
        },
        orderBy: [{ createdAt: "desc" as const }]
      }
    };
  }

  private mapWorkOrder<
    T extends {
      startedAt?: Date | null;
      finishedAt?: Date | null;
      serviceLines: Array<{
        lineTotalMinor: number;
        serviceCompletions?: Array<{
          id: string;
          completedAt: Date;
          employee: { id: string; fullName: string };
        }>;
      }>;
      assignments?: Array<{
        id: string;
        employeeId: string;
        workOrderServiceLineId: string | null;
        unassignedAt: Date | null;
        employee: { id: string; fullName: string };
      }>;
      workerScanEvents?: Array<{
        id: string;
        matchedVin: boolean;
        acceptedAt: Date | null;
        enteredVin: string;
        createdAt: Date;
        employee: { id: string; fullName: string };
      }>;
    }
  >(workOrder: T) {
    const totalServiceAmountMinor = workOrder.serviceLines.reduce(
      (sum, line) => sum + line.lineTotalMinor,
      0
    );

    const activeWorkOrderAssignment =
      workOrder.assignments?.find(
        (assignment) => !assignment.workOrderServiceLineId && assignment.unassignedAt === null
      ) ?? null;

    const lastResponsibilityConfirmation =
      workOrder.workerScanEvents?.find(
        (scanEvent) => scanEvent.matchedVin && scanEvent.acceptedAt !== null
      ) ?? null;

    const serviceLines = workOrder.serviceLines.map((line) => {
      const activeCompletion = line.serviceCompletions?.[0] ?? null;
      const { serviceCompletions: _serviceCompletions, ...lineWithoutCompletions } = line;

      return {
        ...lineWithoutCompletions,
        activeCompletion: activeCompletion
          ? {
              id: activeCompletion.id,
              completedAt: activeCompletion.completedAt,
              employee: activeCompletion.employee
            }
          : null
      };
    });

    const completedServiceLineCount = serviceLines.filter((line) => line.activeCompletion).length;
    const startedAt = workOrder.startedAt ?? null;
    const finishedAt = workOrder.finishedAt ?? null;
    const totalDurationMs =
      startedAt && finishedAt ? finishedAt.getTime() - startedAt.getTime() : null;

    return {
      ...workOrder,
      serviceLines,
      serviceLineCount: workOrder.serviceLines.length,
      completedServiceLineCount,
      completionProgressLabel: `${completedServiceLineCount} of ${workOrder.serviceLines.length} services completed`,
      totalServiceAmountMinor,
      startedAt,
      finishedAt,
      totalDurationMs,
      assignedEmployee: activeWorkOrderAssignment
        ? {
            id: activeWorkOrderAssignment.employee.id,
            fullName: activeWorkOrderAssignment.employee.fullName
          }
        : null,
      activeAssignmentId: activeWorkOrderAssignment?.id ?? null,
      lastResponsibilityConfirmation: lastResponsibilityConfirmation
        ? {
            scanEventId: lastResponsibilityConfirmation.id,
            employeeName: lastResponsibilityConfirmation.employee.fullName,
            acceptedAt: lastResponsibilityConfirmation.acceptedAt,
            enteredVin: lastResponsibilityConfirmation.enteredVin
          }
        : null
    };
  }

  private parseWorkOrderCreateStatus(status?: WorkOrderStatus) {
    if (status === undefined) {
      return WorkOrderStatus.DRAFT;
    }

    if (status !== WorkOrderStatus.DRAFT && status !== WorkOrderStatus.READY) {
      throw new BadRequestException("Work orders can only be created as DRAFT or READY.");
    }

    return status;
  }

  private assertWorkOrderStatusTransition(fromStatus: WorkOrderStatus, toStatus: WorkOrderStatus) {
    if (fromStatus === toStatus) {
      return;
    }

    if (fromStatus === WorkOrderStatus.DRAFT && toStatus === WorkOrderStatus.READY) {
      return;
    }

    if (
      (fromStatus === WorkOrderStatus.DRAFT || fromStatus === WorkOrderStatus.READY) &&
      toStatus === WorkOrderStatus.ASSIGNED
    ) {
      return;
    }

    throw new BadRequestException(`Cannot transition work order from ${fromStatus} to ${toStatus}.`);
  }

  private buildWorkOrderLocationFilter(
    access: CompanyAccessContext,
    locationId?: string
  ): Prisma.WorkOrderWhereInput {
    if (locationId) {
      return { locationId };
    }

    if (access.unrestrictedLocations) {
      return {};
    }

    return { locationId: { in: access.allowedLocationIds } };
  }

  private async requireWorkOrderOperationalAccess(
    principal: AuthenticatedPrincipal,
    workOrderId: string
  ) {
    const workOrder = await this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: this.workOrderInclude()
    });

    if (!workOrder) {
      throw new NotFoundException("Work order not found.");
    }

    await this.companyScopeService.getCompanyAccessContext(principal, workOrder.companyId);
    await this.companyScopeService.assertLocationFilterAllowed(
      principal,
      workOrder.companyId,
      workOrder.locationId
    );

    return workOrder;
  }

  private async resolveActiveVehicleForWorkOrder(companyId: string, vehicleId: string) {
    const id = vehicleId?.trim() ?? "";
    if (!id) {
      throw new BadRequestException("Vehicle is required.");
    }

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, companyId, archivedAt: null }
    });

    if (!vehicle) {
      throw new BadRequestException("Active vehicle not found for this company.");
    }

    return vehicle;
  }

  private async resolveActiveCatalogItemsForWorkOrder(companyId: string, serviceCatalogItemIds: string[]) {
    const uniqueIds = [...new Set((serviceCatalogItemIds ?? []).map((id) => id.trim()).filter(Boolean))];

    if (uniqueIds.length === 0) {
      throw new BadRequestException("At least one active service catalog item is required.");
    }

    const catalogItems = await this.prisma.serviceCatalogItem.findMany({
      where: {
        id: { in: uniqueIds },
        companyId,
        archivedAt: null
      }
    });

    if (catalogItems.length !== uniqueIds.length) {
      throw new BadRequestException("One or more service catalog items are invalid or archived.");
    }

    return uniqueIds.map((id) => catalogItems.find((item) => item.id === id)!);
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

  async listClientInvoices(
    principal: AuthenticatedPrincipal,
    companyId: string,
    options: ListClientInvoicesOptions = {}
  ) {
    await this.companyScopeService.requireManagementCompany(principal, companyId);

    const search = options.q?.trim();
    const invoices = await this.prisma.clientInvoice.findMany({
      where: {
        companyId,
        ...(options.serviceClientId ? { serviceClientId: options.serviceClientId } : {}),
        ...(options.status ? { status: options.status } : {}),
        ...(search
          ? {
              OR: [
                { invoiceNumber: { contains: search, mode: "insensitive" } },
                { serviceClient: { name: { contains: search, mode: "insensitive" } } },
                {
                  lines: {
                    some: {
                      OR: [
                        { workOrderNumberSnapshot: { contains: search, mode: "insensitive" } },
                        { vinSnapshot: { contains: search, mode: "insensitive" } },
                        { serviceNameSnapshot: { contains: search, mode: "insensitive" } }
                      ]
                    }
                  }
                }
              ]
            }
          : {})
      },
      include: {
        serviceClient: { select: { id: true, name: true } },
        lines: { select: { workOrderId: true, vehicleId: true } }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return invoices.map((invoice) => this.mapClientInvoiceSummary(invoice));
  }

  async getCompanyBillingSettings(principal: AuthenticatedPrincipal, companyId: string) {
    const company = await this.companyScopeService.requireManagementCompany(principal, companyId);
    const settings = await this.ensureCompanyBillingSettings(company.groupId, companyId);

    return this.mapCompanyBillingSettings(settings, company);
  }

  async updateCompanyBillingSettings(
    principal: AuthenticatedPrincipal,
    companyId: string,
    input: BillingSettingsInput
  ) {
    const company = await this.companyScopeService.requireManagementCompany(principal, companyId);
    await this.ensureCompanyBillingSettings(company.groupId, companyId);

    const updateData: Prisma.CompanyBillingSettingsUpdateInput = {};

    if (input.invoicePrefix !== undefined && input.invoicePrefix !== null) {
      updateData.invoicePrefix = this.normalizeInvoicePrefix(input.invoicePrefix);
    }

    if (input.paymentTermsDays !== undefined && input.paymentTermsDays !== null) {
      updateData.paymentTermsDays = this.parsePaymentTermsDays(input.paymentTermsDays);
    }

    if (input.defaultNotes !== undefined) {
      updateData.defaultNotes =
        input.defaultNotes === null ? null : this.normalizeOptionalText(input.defaultNotes) ?? null;
    }

    const updated = await this.prisma.companyBillingSettings.update({
      where: { companyId },
      data: updateData
    });

    return this.mapCompanyBillingSettings(updated, company);
  }

  async getCompanyBillingSummary(principal: AuthenticatedPrincipal, companyId: string) {
    await this.companyScopeService.requireManagementCompany(principal, companyId);

    const now = new Date();
    const [outstandingAggregate, overdueAggregate, outstandingCount, overdueCount] = await Promise.all([
      this.prisma.clientInvoice.aggregate({
        where: this.outstandingInvoiceWhere(companyId),
        _sum: { balanceMinor: true, totalMinor: true }
      }),
      this.prisma.clientInvoice.aggregate({
        where: this.outstandingInvoiceWhere(companyId, { overdueAt: now }),
        _sum: { balanceMinor: true, totalMinor: true }
      }),
      this.prisma.clientInvoice.count({ where: this.outstandingInvoiceWhere(companyId) }),
      this.prisma.clientInvoice.count({ where: this.outstandingInvoiceWhere(companyId, { overdueAt: now }) })
    ]);

    return {
      companyId,
      outstandingInvoiceCount: outstandingCount,
      overdueInvoiceCount: overdueCount,
      outstandingBalanceMinor: outstandingAggregate._sum.balanceMinor ?? outstandingAggregate._sum.totalMinor ?? 0,
      overdueBalanceMinor: overdueAggregate._sum.balanceMinor ?? overdueAggregate._sum.totalMinor ?? 0,
      asOf: now
    };
  }

  async listOutstandingClientInvoices(principal: AuthenticatedPrincipal, companyId: string) {
    await this.companyScopeService.requireManagementCompany(principal, companyId);

    const now = new Date();
    const invoices = await this.prisma.clientInvoice.findMany({
      where: this.outstandingInvoiceWhere(companyId),
      include: {
        serviceClient: { select: { id: true, name: true } },
        lines: { select: { workOrderId: true, vehicleId: true } }
      },
      orderBy: [{ dueDate: "asc" }, { issuedAt: "asc" }]
    });

    return invoices.map((invoice) => ({
      ...this.mapClientInvoiceSummary(invoice),
      isOverdue: Boolean(invoice.dueDate && invoice.dueDate < now)
    }));
  }

  async listCompanyDebtors(principal: AuthenticatedPrincipal, companyId: string) {
    await this.companyScopeService.requireManagementCompany(principal, companyId);

    const now = new Date();
    const invoices = await this.prisma.clientInvoice.findMany({
      where: this.outstandingInvoiceWhere(companyId),
      include: {
        serviceClient: { select: { id: true, name: true } },
        lines: { select: { workOrderId: true, vehicleId: true } }
      },
      orderBy: [{ serviceClient: { name: "asc" } }, { dueDate: "asc" }, { issuedAt: "asc" }]
    });

    const debtors = new Map<
      string,
      {
        serviceClient: { id: string; name: string };
        outstandingInvoiceCount: number;
        overdueInvoiceCount: number;
        outstandingBalanceMinor: number;
        overdueBalanceMinor: number;
        invoices: Array<Record<string, unknown> & { isOverdue: boolean }>;
      }
    >();

    for (const invoice of invoices) {
      const balanceMinor = invoice.balanceMinor || invoice.totalMinor;
      const isOverdue = Boolean(invoice.dueDate && invoice.dueDate < now);
      const debtor = debtors.get(invoice.serviceClient.id) ?? {
        serviceClient: invoice.serviceClient,
        outstandingInvoiceCount: 0,
        overdueInvoiceCount: 0,
        outstandingBalanceMinor: 0,
        overdueBalanceMinor: 0,
        invoices: []
      };

      debtor.outstandingInvoiceCount += 1;
      debtor.outstandingBalanceMinor += balanceMinor;
      if (isOverdue) {
        debtor.overdueInvoiceCount += 1;
        debtor.overdueBalanceMinor += balanceMinor;
      }
      debtor.invoices.push({ ...this.mapClientInvoiceSummary(invoice), isOverdue });
      debtors.set(invoice.serviceClient.id, debtor);
    }

    return [...debtors.values()];
  }

  async getClientInvoice(principal: AuthenticatedPrincipal, clientInvoiceId: string) {
    const invoice = await this.requireClientInvoiceAccess(principal, clientInvoiceId);
    return this.mapClientInvoiceDetail(invoice);
  }

  async listInvoiceableWorkOrders(
    principal: AuthenticatedPrincipal,
    companyId: string,
    serviceClientId: string
  ) {
    await this.companyScopeService.requireManagementCompany(principal, companyId);

    const clientId = serviceClientId?.trim() ?? "";
    if (!clientId) {
      throw new BadRequestException("Service client is required.");
    }

    const serviceClient = await this.prisma.serviceClient.findFirst({
      where: { id: clientId, companyId, archivedAt: null }
    });

    if (!serviceClient) {
      throw new BadRequestException("Active service client not found for this company.");
    }

    const workOrders = await this.prisma.workOrder.findMany({
      where: {
        companyId,
        serviceClientId: clientId,
        status: WorkOrderStatus.COMPLETED
      },
      include: {
        vehicle: {
          select: {
            id: true,
            vin: true,
            year: true,
            make: true,
            model: true,
            plate: true
          }
        },
        serviceLines: {
          orderBy: { createdAt: "asc" },
          include: {
            serviceCompletions: {
              where: { voidedAt: null },
              take: 1
            }
          }
        },
        clientInvoiceLines: {
          where: {
            clientInvoice: { status: { in: [ClientInvoiceStatus.DRAFT, ClientInvoiceStatus.ISSUED] } }
          },
          take: 1
        }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return workOrders
      .filter((workOrder) => this.isWorkOrderInvoiceReady(workOrder))
      .map((workOrder) => ({
        id: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        serviceClientId: workOrder.serviceClientId,
        vehicle: workOrder.vehicle,
        serviceLineCount: workOrder.serviceLines.length,
        totalServiceAmountMinor: workOrder.serviceLines.reduce(
          (sum, line) => sum + line.lineTotalMinor,
          0
        ),
        currencyCode: workOrder.serviceLines[0]?.currencyCode ?? "USD",
        serviceLines: workOrder.serviceLines.map((line) => ({
          id: line.id,
          serviceNameSnapshot: line.serviceNameSnapshot,
          serviceCategorySnapshot: line.serviceCategorySnapshot,
          lineTotalMinor: line.lineTotalMinor,
          currencyCode: line.currencyCode
        }))
      }));
  }

  async createClientInvoice(
    principal: AuthenticatedPrincipal,
    companyId: string,
    input: CreateClientInvoiceInput
  ) {
    const company = await this.companyScopeService.requireManagementCompany(principal, companyId);

    const serviceClientId = input.serviceClientId?.trim() ?? "";
    if (!serviceClientId) {
      throw new BadRequestException("Service client is required.");
    }

    const serviceClient = await this.prisma.serviceClient.findFirst({
      where: { id: serviceClientId, companyId, archivedAt: null }
    });

    if (!serviceClient) {
      throw new BadRequestException("Active service client not found for this company.");
    }

    const uniqueWorkOrderIds = [...new Set((input.workOrderIds ?? []).map((id) => id.trim()).filter(Boolean))];
    const vehicleId = input.vehicleId?.trim() || null;
    const notes = this.normalizeOptionalText(input.notes);

    let vehicleSnapshot: {
      vehicleId: string;
      vinSnapshot: string;
      makeSnapshot: string | null;
      plateSnapshot: string | null;
      colorSnapshot: string | null;
      vehicleLabelSnapshot: string | null;
    } | null = null;

    if (vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: vehicleId, companyId, archivedAt: null }
      });

      if (!vehicle) {
        throw new BadRequestException("Active vehicle not found for this company.");
      }

      if (vehicle.serviceClientId !== serviceClientId) {
        throw new BadRequestException("Vehicle must belong to the selected service client.");
      }

      vehicleSnapshot = {
        vehicleId: vehicle.id,
        vinSnapshot: vehicle.vin,
        makeSnapshot: vehicle.make?.trim() || null,
        plateSnapshot: vehicle.plate?.trim() || null,
        colorSnapshot: vehicle.color?.trim() || null,
        vehicleLabelSnapshot: this.buildVehicleLabelSnapshot(vehicle)
      };
    }

    if (uniqueWorkOrderIds.length === 0) {
      return this.prisma.$transaction(async (tx) => {
        const invoice = await tx.clientInvoice.create({
          data: {
            groupId: company.groupId,
            companyId,
            serviceClientId,
            status: ClientInvoiceStatus.DRAFT,
            subtotalMinor: 0,
            taxMinor: 0,
            totalMinor: 0,
            currencyCode: company.currencyCode,
            amountPaidMinor: 0,
            balanceMinor: 0,
            notes
          },
          include: this.clientInvoiceInclude()
        });

        await this.createAuditEvents(tx, [
          {
            actorUserId: principal.userId,
            action: "CLIENT_INVOICE_DRAFT_CREATED",
            targetType: "ClientInvoice",
            targetId: invoice.id,
            groupId: company.groupId,
            companyId,
            metadata: {
              serviceClientId,
              workOrderIds: [],
              vehicleId: vehicleSnapshot?.vehicleId ?? null,
              manual: true,
              lineCount: 0,
              totalMinor: 0
            }
          }
        ]);

        const mapped = this.mapClientInvoiceDetail(invoice);
        return {
          ...mapped,
          defaultVehicleId: vehicleSnapshot?.vehicleId ?? null
        };
      });
    }

    const workOrders = await this.prisma.workOrder.findMany({
      where: {
        id: { in: uniqueWorkOrderIds },
        companyId
      },
      include: {
        vehicle: true,
        serviceLines: {
          orderBy: { createdAt: "asc" },
          include: {
            serviceCompletions: {
              where: { voidedAt: null },
              orderBy: { completedAt: "asc" },
              select: { notes: true }
            }
          }
        },
        clientInvoiceLines: {
          where: {
            clientInvoice: { status: { in: [ClientInvoiceStatus.DRAFT, ClientInvoiceStatus.ISSUED] } }
          },
          take: 1
        }
      }
    });

    if (workOrders.length !== uniqueWorkOrderIds.length) {
      throw new BadRequestException("One or more work orders were not found for this company.");
    }

    for (const workOrder of workOrders) {
      if (workOrder.serviceClientId !== serviceClientId) {
        throw new BadRequestException("All work orders must belong to the selected service client.");
      }

      if (!this.isWorkOrderInvoiceReady(workOrder)) {
        throw new BadRequestException(
          `Work order ${workOrder.workOrderNumber} is not invoice-ready.`
        );
      }
    }

    const linePayloads = workOrders.flatMap((workOrder) =>
      workOrder.serviceLines.map((line) => {
        const completionNotes = line.serviceCompletions
          .map((completion) => completion.notes?.trim())
          .filter((note): note is string => Boolean(note));
        const workNotes =
          line.notes?.trim() ||
          completionNotes.join(" · ") ||
          workOrder.notes?.trim() ||
          null;

        return {
          groupId: company.groupId,
          companyId,
          workOrderId: workOrder.id,
          workOrderServiceLineId: line.id,
          vehicleId: workOrder.vehicleId,
          workOrderNumberSnapshot: workOrder.workOrderNumber,
          vinSnapshot: workOrder.vehicle.vin,
          makeSnapshot: workOrder.vehicle.make?.trim() || null,
          plateSnapshot: workOrder.vehicle.plate?.trim() || null,
          colorSnapshot: workOrder.vehicle.color?.trim() || null,
          vehicleLabelSnapshot: this.buildVehicleLabelSnapshot(workOrder.vehicle),
          serviceNameSnapshot: line.serviceNameSnapshot,
          serviceCategorySnapshot: line.serviceCategorySnapshot,
          description: workNotes,
          quantity: line.quantity,
          unitPriceMinor: line.unitPriceMinor,
          lineTotalMinor: line.lineTotalMinor,
          currencyCode: line.currencyCode
        };
      })
    );

    const subtotalMinor = linePayloads.reduce((sum, line) => sum + line.lineTotalMinor, 0);
    const taxMinor = 0;
    const totalMinor = subtotalMinor + taxMinor;
    const currencyCode = linePayloads[0]?.currencyCode ?? company.currencyCode;

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.clientInvoice.create({
        data: {
          groupId: company.groupId,
          companyId,
          serviceClientId,
          status: ClientInvoiceStatus.DRAFT,
          subtotalMinor,
          taxMinor,
          totalMinor,
          currencyCode,
          amountPaidMinor: 0,
          balanceMinor: totalMinor,
          notes,
          lines: {
            create: linePayloads
          }
        },
        include: this.clientInvoiceInclude()
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "CLIENT_INVOICE_DRAFT_CREATED",
          targetType: "ClientInvoice",
          targetId: invoice.id,
          groupId: company.groupId,
          companyId,
          metadata: {
            serviceClientId,
            workOrderIds: uniqueWorkOrderIds,
            lineCount: linePayloads.length,
            totalMinor
          }
        }
      ]);

      return this.mapClientInvoiceDetail(invoice);
    });
  }

  async updateClientInvoiceDraft(
    principal: AuthenticatedPrincipal,
    clientInvoiceId: string,
    input: UpdateClientInvoiceDraftInput
  ) {
    const invoice = await this.requireClientInvoiceAccess(principal, clientInvoiceId);

    if (invoice.status !== ClientInvoiceStatus.DRAFT) {
      throw new BadRequestException("Only draft invoices can be modified.");
    }

    const updateData: Prisma.ClientInvoiceUpdateInput = {};

    if (input.notes !== undefined) {
      updateData.notes = input.notes ? input.notes.trim() : null;
    }

    if (input.dueDate !== undefined) {
      updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    }

    if (input.serviceClientId && input.serviceClientId !== invoice.serviceClientId) {
      const serviceClient = await this.prisma.serviceClient.findFirst({
        where: { id: input.serviceClientId, companyId: invoice.companyId, archivedAt: null }
      });

      if (!serviceClient) {
        throw new BadRequestException("Active service client not found for this company.");
      }

      updateData.serviceClient = { connect: { id: input.serviceClientId } };
    }

    const updated = await this.prisma.clientInvoice.update({
      where: { id: clientInvoiceId },
      data: updateData,
      include: this.clientInvoiceInclude()
    });

    await this.prisma.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        action: "CLIENT_INVOICE_DRAFT_UPDATED",
        targetType: "ClientInvoice",
        targetId: clientInvoiceId,
        groupId: invoice.groupId,
        companyId: invoice.companyId,
        metadata: { updates: input }
      }
    });

    return this.mapClientInvoiceDetail(updated);
  }

  async addClientInvoiceLine(
    principal: AuthenticatedPrincipal,
    clientInvoiceId: string,
    input: CreateClientInvoiceLineInput
  ) {
    const invoice = await this.requireClientInvoiceAccess(principal, clientInvoiceId);

    if (invoice.status !== ClientInvoiceStatus.DRAFT) {
      throw new BadRequestException("Only draft invoices can have line items added.");
    }

    if (input.quantity < 0) {
      throw new BadRequestException("Quantity cannot be negative.");
    }

    if (input.unitPriceMinor < 0) {
      throw new BadRequestException("Unit price cannot be negative.");
    }

    const lineSubtotalMinor = input.quantity * input.unitPriceMinor;
    const taxable = input.taxable ?? false;
    const taxRate = input.taxRate ?? 0;
    const taxAmountMinor = taxable ? Math.round(lineSubtotalMinor * taxRate) : 0;
    const lineTotalMinor = lineSubtotalMinor + taxAmountMinor;

    const vehicleId = input.vehicleId?.trim() || null;
    let vehicleFields: {
      vehicleId: string | null;
      vinSnapshot: string | null;
      makeSnapshot: string | null;
      plateSnapshot: string | null;
      colorSnapshot: string | null;
      vehicleLabelSnapshot: string | null;
    } = {
      vehicleId: null,
      vinSnapshot: null,
      makeSnapshot: null,
      plateSnapshot: null,
      colorSnapshot: null,
      vehicleLabelSnapshot: null
    };

    if (vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: vehicleId, companyId: invoice.companyId, archivedAt: null }
      });

      if (!vehicle) {
        throw new BadRequestException("Active vehicle not found for this company.");
      }

      if (vehicle.serviceClientId !== invoice.serviceClientId) {
        throw new BadRequestException("Vehicle must belong to the invoice service client.");
      }

      vehicleFields = {
        vehicleId: vehicle.id,
        vinSnapshot: vehicle.vin,
        makeSnapshot: vehicle.make?.trim() || null,
        plateSnapshot: vehicle.plate?.trim() || null,
        colorSnapshot: vehicle.color?.trim() || null,
        vehicleLabelSnapshot: this.buildVehicleLabelSnapshot(vehicle)
      };
    }

    const line = await this.prisma.clientInvoiceLine.create({
      data: {
        groupId: invoice.groupId,
        companyId: invoice.companyId,
        clientInvoiceId,
        workOrderId: null,
        workOrderServiceLineId: null,
        vehicleId: vehicleFields.vehicleId,
        vinSnapshot: vehicleFields.vinSnapshot,
        makeSnapshot: vehicleFields.makeSnapshot,
        plateSnapshot: vehicleFields.plateSnapshot,
        colorSnapshot: vehicleFields.colorSnapshot,
        vehicleLabelSnapshot: vehicleFields.vehicleLabelSnapshot,
        workOrderNumberSnapshot: null,
        serviceNameSnapshot: input.description.substring(0, 100),
        description: input.description,
        quantity: input.quantity,
        unitPriceMinor: input.unitPriceMinor,
        lineTotalMinor,
        taxable,
        taxRate,
        taxAmountMinor,
        lineSubtotalMinor,
        lineItemType: input.type,
        lineItemSource: "MANUAL",
        sortOrder: input.sortOrder ?? 0
      }
    });

    await this.recalculateInvoiceTotals(clientInvoiceId);

    await this.prisma.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        action: "CLIENT_INVOICE_LINE_ITEM_ADDED",
        targetType: "ClientInvoice",
        targetId: clientInvoiceId,
        groupId: invoice.groupId,
        companyId: invoice.companyId,
        metadata: {
          lineId: line.id,
          type: input.type,
          description: input.description,
          lineTotalMinor
        }
      }
    });

    const updatedInvoice = await this.prisma.clientInvoice.findUnique({
      where: { id: clientInvoiceId },
      include: this.clientInvoiceInclude()
    });

    return this.mapClientInvoiceDetail(updatedInvoice!);
  }

  async updateClientInvoiceLine(
    principal: AuthenticatedPrincipal,
    clientInvoiceId: string,
    lineId: string,
    input: UpdateClientInvoiceLineInput
  ) {
    const invoice = await this.requireClientInvoiceAccess(principal, clientInvoiceId);

    if (invoice.status !== ClientInvoiceStatus.DRAFT) {
      throw new BadRequestException("Only draft invoices can have line items modified.");
    }

    const line = await this.prisma.clientInvoiceLine.findFirst({
      where: { id: lineId, clientInvoiceId }
    });

    if (!line) {
      throw new NotFoundException("Line item not found on this invoice.");
    }

    const updateData: Prisma.ClientInvoiceLineUpdateInput = {};

    if (input.description !== undefined) {
      updateData.description = input.description;
      updateData.serviceNameSnapshot = input.description.substring(0, 100);
    }

    if (input.type !== undefined) {
      updateData.lineItemType = input.type;
    }

    if (input.quantity !== undefined) {
      if (input.quantity < 0) {
        throw new BadRequestException("Quantity cannot be negative.");
      }
      updateData.quantity = input.quantity;
    }

    if (input.unitPriceMinor !== undefined) {
      if (input.unitPriceMinor < 0) {
        throw new BadRequestException("Unit price cannot be negative.");
      }
      updateData.unitPriceMinor = input.unitPriceMinor;
    }

    if (input.taxable !== undefined) {
      updateData.taxable = input.taxable;
    }

    if (input.taxRate !== undefined) {
      updateData.taxRate = input.taxRate;
    }

    if (input.sortOrder !== undefined) {
      updateData.sortOrder = input.sortOrder;
    }

    const updatedLine = await this.prisma.clientInvoiceLine.update({
      where: { id: lineId },
      data: updateData
    });

    const lineSubtotalMinor = updatedLine.quantity * updatedLine.unitPriceMinor;
    const taxAmountMinor = updatedLine.taxable ? Math.round(lineSubtotalMinor * updatedLine.taxRate) : 0;
    const lineTotalMinor = lineSubtotalMinor + taxAmountMinor;

    await this.prisma.clientInvoiceLine.update({
      where: { id: lineId },
      data: {
        lineSubtotalMinor,
        taxAmountMinor,
        lineTotalMinor
      }
    });

    await this.recalculateInvoiceTotals(clientInvoiceId);

    await this.prisma.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        action: "CLIENT_INVOICE_LINE_ITEM_UPDATED",
        targetType: "ClientInvoice",
        targetId: clientInvoiceId,
        groupId: invoice.groupId,
        companyId: invoice.companyId,
        metadata: {
          lineId,
          updates: input
        }
      }
    });

    const updatedInvoice = await this.prisma.clientInvoice.findUnique({
      where: { id: clientInvoiceId },
      include: this.clientInvoiceInclude()
    });

    return this.mapClientInvoiceDetail(updatedInvoice!);
  }

  async removeClientInvoiceLine(
    principal: AuthenticatedPrincipal,
    clientInvoiceId: string,
    lineId: string
  ) {
    const invoice = await this.requireClientInvoiceAccess(principal, clientInvoiceId);

    if (invoice.status !== ClientInvoiceStatus.DRAFT) {
      throw new BadRequestException("Only draft invoices can have line items removed.");
    }

    const line = await this.prisma.clientInvoiceLine.findFirst({
      where: { id: lineId, clientInvoiceId }
    });

    if (!line) {
      throw new NotFoundException("Line item not found on this invoice.");
    }

    await this.prisma.clientInvoiceLine.delete({
      where: { id: lineId }
    });

    await this.recalculateInvoiceTotals(clientInvoiceId);

    await this.prisma.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        action: "CLIENT_INVOICE_LINE_ITEM_REMOVED",
        targetType: "ClientInvoice",
        targetId: clientInvoiceId,
        groupId: invoice.groupId,
        companyId: invoice.companyId,
        metadata: {
          lineId,
          lineTotalMinor: line.lineTotalMinor
        }
      }
    });

    const updatedInvoice = await this.prisma.clientInvoice.findUnique({
      where: { id: clientInvoiceId },
      include: this.clientInvoiceInclude()
    });

    return this.mapClientInvoiceDetail(updatedInvoice!);
  }

  private async recalculateInvoiceTotals(clientInvoiceId: string) {
    const lines = await this.prisma.clientInvoiceLine.findMany({
      where: { clientInvoiceId }
    });

    const subtotalMinor = lines.reduce((sum, line) => sum + (line.lineSubtotalMinor ?? 0), 0);
    const taxMinor = lines.reduce((sum, line) => sum + (line.taxAmountMinor ?? 0), 0);
    const totalMinor = subtotalMinor + taxMinor;

    await this.prisma.clientInvoice.update({
      where: { id: clientInvoiceId },
      data: {
        subtotalMinor,
        taxMinor,
        totalMinor,
        balanceMinor: totalMinor
      }
    });
  }

  async issueClientInvoice(principal: AuthenticatedPrincipal, clientInvoiceId: string) {
    const invoice = await this.requireClientInvoiceAccess(principal, clientInvoiceId);
    await this.companyScopeService.requireManagementCompany(principal, invoice.companyId);

    if (invoice.status !== ClientInvoiceStatus.DRAFT) {
      throw new BadRequestException("Only draft invoices can be issued.");
    }

    if (invoice.lines.length === 0) {
      throw new BadRequestException("Invoice must contain at least one line.");
    }

    const now = new Date();
    const workOrderIds = [
      ...new Set(invoice.lines.map((line) => line.workOrderId).filter((id): id is string => id !== null))
    ];
    const company = await this.prisma.company.findUnique({ where: { id: invoice.companyId } });

    if (!company) {
      throw new NotFoundException("Company not found.");
    }

    const billingSettings = await this.ensureCompanyBillingSettings(company.groupId, company.id);
    const dueDate = this.addUtcDays(now, billingSettings.paymentTermsDays);
    const issuerSnapshot = this.buildIssuerSnapshot(company, {
      paymentInstructions: billingSettings.defaultNotes
    });
    const billToSnapshot = this.buildBillToSnapshot(invoice.serviceClient);

    return this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.generateClientInvoiceNumber(tx, company, billingSettings.invoicePrefix);

      const issued = await tx.clientInvoice.update({
        where: { id: clientInvoiceId },
        data: {
          status: ClientInvoiceStatus.ISSUED,
          invoiceNumber,
          dueDate,
          paymentTermsDays: billingSettings.paymentTermsDays,
          issuerSnapshot,
          billToSnapshot,
          amountPaidMinor: 0,
          balanceMinor: invoice.totalMinor,
          issuedAt: now,
          issuedByUserId: principal.userId
        },
        include: this.clientInvoiceInclude()
      });

      for (const workOrderId of workOrderIds) {
        const workOrder = await tx.workOrder.findUnique({ where: { id: workOrderId } });
        if (!workOrder) {
          continue;
        }

        if (workOrder.status !== WorkOrderStatus.COMPLETED) {
          throw new BadRequestException("Only completed work orders can be invoiced.");
        }

        await tx.workOrder.update({
          where: { id: workOrderId },
          data: {
            status: WorkOrderStatus.INVOICED,
            invoicedClientInvoiceId: clientInvoiceId
          }
        });

        await tx.workOrderStatusHistory.create({
          data: {
            groupId: workOrder.groupId,
            companyId: workOrder.companyId,
            workOrderId,
            fromStatus: workOrder.status,
            toStatus: WorkOrderStatus.INVOICED,
            reason: `Invoice ${invoiceNumber} issued`,
            createdByUserId: principal.userId
          }
        });
      }

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "CLIENT_INVOICE_ISSUED",
          targetType: "ClientInvoice",
          targetId: clientInvoiceId,
          groupId: invoice.groupId,
          companyId: invoice.companyId,
          metadata: {
            invoiceNumber,
            totalMinor: issued.totalMinor
          }
        }
      ]);

      return this.mapClientInvoiceDetail(issued);
    });
  }

  async voidClientInvoice(
    principal: AuthenticatedPrincipal,
    clientInvoiceId: string,
    input: VoidClientInvoiceInput
  ) {
    const invoice = await this.requireClientInvoiceAccess(principal, clientInvoiceId);
    await this.companyScopeService.requireManagementCompany(principal, invoice.companyId);

    if (invoice.status !== ClientInvoiceStatus.ISSUED) {
      throw new BadRequestException("Only issued invoices can be voided.");
    }

    const voidReason = input.voidReason?.trim() ?? "";
    if (!voidReason) {
      throw new BadRequestException("Void reason is required.");
    }

    const now = new Date();
    const workOrderIds = [
      ...new Set(invoice.lines.map((line) => line.workOrderId).filter((id): id is string => id !== null))
    ];

    return this.prisma.$transaction(async (tx) => {
      const voided = await tx.clientInvoice.update({
        where: { id: clientInvoiceId },
        data: {
          status: ClientInvoiceStatus.VOID,
          balanceMinor: 0,
          voidedAt: now,
          voidedByUserId: principal.userId,
          voidReason
        },
        include: this.clientInvoiceInclude()
      });

      for (const workOrderId of workOrderIds) {
        const workOrder = await tx.workOrder.findUnique({ where: { id: workOrderId } });
        if (!workOrder || workOrder.invoicedClientInvoiceId !== clientInvoiceId) {
          continue;
        }

        await tx.workOrder.update({
          where: { id: workOrderId },
          data: {
            status: WorkOrderStatus.COMPLETED,
            invoicedClientInvoiceId: null
          }
        });

        await tx.workOrderStatusHistory.create({
          data: {
            groupId: workOrder.groupId,
            companyId: workOrder.companyId,
            workOrderId,
            fromStatus: WorkOrderStatus.INVOICED,
            toStatus: WorkOrderStatus.COMPLETED,
            reason: `Invoice voided: ${voidReason}`,
            createdByUserId: principal.userId
          }
        });
      }

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "CLIENT_INVOICE_VOIDED",
          targetType: "ClientInvoice",
          targetId: clientInvoiceId,
          groupId: invoice.groupId,
          companyId: invoice.companyId,
          metadata: { voidReason }
        }
      ]);

      return this.mapClientInvoiceDetail(voided);
    });
  }

  private clientInvoiceInclude() {
    return {
      serviceClient: { select: this.serviceClientBillingSelect() },
      issuedByUser: { select: { id: true, fullName: true, email: true } },
      voidedByUser: { select: { id: true, fullName: true, email: true } },
      lines: {
        orderBy: { createdAt: "asc" as const },
        include: {
          vehicle: {
            select: {
              vin: true,
              make: true,
              plate: true,
              color: true,
              year: true,
              model: true
            }
          }
        }
      },
      deliveries: {
        orderBy: { attemptedAt: "desc" as const },
        take: 20,
        include: {
          sentByUser: { select: { id: true, fullName: true, email: true } }
        }
      }
    };
  }

  private serviceClientBillingSelect() {
    return {
      id: true,
      name: true,
      legalName: true,
      taxId: true,
      billingContactName: true,
      phone: true,
      billingEmail: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      stateRegion: true,
      postalCode: true,
      country: true
    } as const;
  }

  private mapClientInvoiceSummary(
    invoice: {
      id: string;
      invoiceNumber: string | null;
      status: ClientInvoiceStatus;
      subtotalMinor: number;
      taxMinor: number;
      totalMinor: number;
      currencyCode: string;
      dueDate: Date | null;
      paymentTermsDays: number | null;
      amountPaidMinor: number;
      balanceMinor: number;
      createdAt: Date;
      issuedAt: Date | null;
      serviceClient: { id: string; name: string };
      lines: Array<{ workOrderId: string | null; vehicleId: string | null }>;
    }
  ) {
    const workOrderIds = invoice.lines.map((line) => line.workOrderId).filter((id): id is string => id !== null);
    const vehicleIds = invoice.lines.map((line) => line.vehicleId).filter((id): id is string => id !== null);
    const workOrderCount = new Set(workOrderIds).size;
    const vehicleCount = new Set(vehicleIds).size;

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      serviceClient: invoice.serviceClient,
      workOrderCount,
      vehicleCount,
      lineCount: invoice.lines.length,
      subtotalMinor: invoice.subtotalMinor,
      taxMinor: invoice.taxMinor,
      totalMinor: invoice.totalMinor,
      currencyCode: invoice.currencyCode,
      dueDate: invoice.dueDate,
      paymentTermsDays: invoice.paymentTermsDays,
      amountPaidMinor: invoice.amountPaidMinor,
      balanceMinor: invoice.balanceMinor,
      createdAt: invoice.createdAt,
      issuedAt: invoice.issuedAt
    };
  }

  private mapClientInvoiceDetail(
    invoice: {
      id: string;
      companyId: string;
      serviceClientId: string;
      invoiceNumber: string | null;
      status: ClientInvoiceStatus;
      subtotalMinor: number;
      taxMinor: number;
      totalMinor: number;
      currencyCode: string;
      notes: string | null;
      dueDate: Date | null;
      paymentTermsDays: number | null;
      issuerSnapshot: Prisma.JsonValue | null;
      billToSnapshot: Prisma.JsonValue | null;
      amountPaidMinor: number;
      balanceMinor: number;
      createdAt: Date;
      updatedAt: Date;
      issuedAt: Date | null;
      voidedAt: Date | null;
      voidReason: string | null;
      serviceClient: { id: string; name: string };
      issuedByUser: { id: string; fullName: string | null; email: string } | null;
      voidedByUser: { id: string; fullName: string | null; email: string } | null;
      lines: Array<{
        id: string;
        workOrderId: string | null;
        workOrderServiceLineId: string | null;
        vehicleId: string | null;
        workOrderNumberSnapshot: string | null;
        vinSnapshot: string | null;
        makeSnapshot: string | null;
        plateSnapshot: string | null;
        colorSnapshot: string | null;
        vehicleLabelSnapshot: string | null;
        serviceNameSnapshot: string;
        serviceCategorySnapshot: string | null;
        description: string | null;
        quantity: number;
        unitPriceMinor: number;
        lineSubtotalMinor: number;
        taxRate: number;
        taxable: boolean;
        taxAmountMinor: number;
        lineTotalMinor: number;
        currencyCode: string;
        sortOrder: number;
        lineItemType: string;
        lineItemSource: string;
        sourceId: string | null;
        createdAt: Date;
        vehicle?: {
          vin: string;
          make: string | null;
          plate: string | null;
          color: string | null;
          year: number | null;
          model: string | null;
        } | null;
      }>;
      deliveries?: Array<{
        id: string;
        channel: string;
        recipientEmail: string;
        subject: string;
        status: string;
        provider: string;
        providerMessageId: string | null;
        errorMessage: string | null;
        messageNote: string | null;
        sentAt: Date | null;
        attemptedAt: Date;
        createdAt: Date;
        sentByUser: { id: string; fullName: string | null; email: string } | null;
      }>;
    }
  ) {
    const summary = this.mapClientInvoiceSummary(invoice);

    return {
      ...summary,
      companyId: invoice.companyId,
      serviceClientId: invoice.serviceClientId,
      notes: invoice.notes,
      dueDate: invoice.dueDate,
      paymentTermsDays: invoice.paymentTermsDays,
      issuerSnapshot: invoice.issuerSnapshot,
      billToSnapshot: invoice.billToSnapshot,
      amountPaidMinor: invoice.amountPaidMinor,
      balanceMinor: invoice.balanceMinor,
      updatedAt: invoice.updatedAt,
      voidedAt: invoice.voidedAt,
      voidReason: invoice.voidReason,
      issuedByUser: invoice.issuedByUser,
      voidedByUser: invoice.voidedByUser,
      lines: invoice.lines.map((line) => this.enrichClientInvoiceLine(line)),
      workOrderIds: [...new Set(invoice.lines.map((line) => line.workOrderId).filter((id): id is string => id !== null))],
      deliveries: (invoice.deliveries ?? []).map((delivery) => ({
        id: delivery.id,
        channel: delivery.channel,
        recipientEmail: delivery.recipientEmail,
        subject: delivery.subject,
        status: delivery.status,
        provider: delivery.provider,
        providerMessageId: delivery.providerMessageId,
        errorMessage: delivery.errorMessage,
        messageNote: delivery.messageNote,
        sentAt: delivery.sentAt,
        attemptedAt: delivery.attemptedAt,
        createdAt: delivery.createdAt,
        sentByUser: delivery.sentByUser
      }))
    };
  }

  private enrichClientInvoiceLine(line: {
    id: string;
    workOrderId: string | null;
    workOrderServiceLineId: string | null;
    vehicleId: string | null;
    workOrderNumberSnapshot: string | null;
    vinSnapshot: string | null;
    makeSnapshot: string | null;
    plateSnapshot: string | null;
    colorSnapshot: string | null;
    vehicleLabelSnapshot: string | null;
    serviceNameSnapshot: string;
    serviceCategorySnapshot: string | null;
    description: string | null;
    quantity: number;
    unitPriceMinor: number;
    lineSubtotalMinor: number;
    taxRate: number;
    taxable: boolean;
    taxAmountMinor: number;
    lineTotalMinor: number;
    currencyCode: string;
    sortOrder: number;
    lineItemType: string;
    lineItemSource: string;
    sourceId: string | null;
    createdAt: Date;
    vehicle?: {
      vin: string;
      make: string | null;
      plate: string | null;
      color: string | null;
      year: number | null;
      model: string | null;
    } | null;
  }) {
    const vehicle = line.vehicle;
    const labelFromVehicle = vehicle
      ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ").trim() || null
      : null;

    return {
      id: line.id,
      workOrderId: line.workOrderId,
      workOrderServiceLineId: line.workOrderServiceLineId,
      vehicleId: line.vehicleId,
      workOrderNumberSnapshot: line.workOrderNumberSnapshot,
      vinSnapshot: line.vinSnapshot?.trim() || vehicle?.vin || null,
      makeSnapshot: line.makeSnapshot?.trim() || vehicle?.make?.trim() || null,
      plateSnapshot: line.plateSnapshot?.trim() || vehicle?.plate?.trim() || null,
      colorSnapshot: line.colorSnapshot?.trim() || vehicle?.color?.trim() || null,
      vehicleLabelSnapshot: line.vehicleLabelSnapshot?.trim() || labelFromVehicle,
      serviceNameSnapshot: line.serviceNameSnapshot,
      serviceCategorySnapshot: line.serviceCategorySnapshot,
      description: line.description,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor,
      lineSubtotalMinor: line.lineSubtotalMinor,
      taxRate: line.taxRate,
      taxable: line.taxable,
      taxAmountMinor: line.taxAmountMinor,
      lineTotalMinor: line.lineTotalMinor,
      currencyCode: line.currencyCode,
      sortOrder: line.sortOrder,
      lineItemType: line.lineItemType,
      lineItemSource: line.lineItemSource,
      sourceId: line.sourceId,
      createdAt: line.createdAt
    };
  }

  private async requireClientInvoiceAccess(
    principal: AuthenticatedPrincipal,
    clientInvoiceId: string
  ) {
    const invoice = await this.prisma.clientInvoice.findUnique({
      where: { id: clientInvoiceId },
      include: this.clientInvoiceInclude()
    });

    if (!invoice) {
      throw new NotFoundException("Client invoice not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, invoice.companyId);

    return invoice;
  }

  private isWorkOrderInvoiceReady(workOrder: {
    status: WorkOrderStatus;
    serviceLines: Array<{
      serviceCompletions: Array<unknown>;
    }>;
    clientInvoiceLines: Array<unknown>;
  }) {
    if (workOrder.status !== WorkOrderStatus.COMPLETED) {
      return false;
    }

    if (workOrder.clientInvoiceLines.length > 0) {
      return false;
    }

    return workOrder.serviceLines.every((line) => line.serviceCompletions.length > 0);
  }

  private buildVehicleLabelSnapshot(vehicle: {
    year: number | null;
    make: string | null;
    model: string | null;
  }) {
    const label = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
    return label || null;
  }

  private outstandingInvoiceWhere(companyId: string, options: { overdueAt?: Date } = {}): Prisma.ClientInvoiceWhereInput {
    return {
      companyId,
      status: ClientInvoiceStatus.ISSUED,
      balanceMinor: { gt: 0 },
      ...(options.overdueAt ? { dueDate: { lt: options.overdueAt } } : {})
    };
  }

  private async ensureCompanyBillingSettings(groupId: string, companyId: string) {
    return this.prisma.companyBillingSettings.upsert({
      where: { companyId },
      update: {},
      create: {
        groupId,
        companyId,
        invoicePrefix: "INV",
        paymentTermsDays: 30
      }
    });
  }

  private mapCompanyBillingSettings(
    settings: {
      id: string;
      companyId: string;
      invoicePrefix: string;
      paymentTermsDays: number;
      defaultNotes: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
    company: {
      id: string;
      groupId: string;
      name: string;
      legalName: string | null;
      phone: string | null;
      billingEmail: string | null;
      primaryContactName: string | null;
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      stateRegion: string | null;
      postalCode: string | null;
      country: string | null;
      currencyCode: string;
    }
  ) {
    return {
      id: settings.id,
      companyId: settings.companyId,
      groupId: company.groupId,
      invoicePrefix: settings.invoicePrefix,
      paymentTermsDays: settings.paymentTermsDays,
      defaultNotes: settings.defaultNotes,
      currencyCode: company.currencyCode,
      issuerProfile: {
        companyId: company.id,
        name: company.name,
        legalName: company.legalName,
        phone: company.phone,
        billingEmail: company.billingEmail,
        primaryContactName: company.primaryContactName,
        addressLine1: company.addressLine1,
        addressLine2: company.addressLine2,
        city: company.city,
        stateRegion: company.stateRegion,
        postalCode: company.postalCode,
        country: company.country
      },
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt
    };
  }

  private normalizeInvoicePrefix(value: string) {
    const prefix = value.trim().toUpperCase().replace(/[^A-Z0-9-]/gu, "");
    if (!prefix || prefix.length > 12) {
      throw new BadRequestException("Invoice prefix must contain 1-12 letters, numbers, or dashes.");
    }
    return prefix;
  }

  private parsePaymentTermsDays(value: number) {
    if (!Number.isInteger(value) || value < 0 || value > 365) {
      throw new BadRequestException("Payment terms must be an integer from 0 to 365 days.");
    }
    return value;
  }

  private buildIssuerSnapshot(company: {
    id: string;
    name: string;
    legalName: string | null;
    phone: string | null;
    billingEmail: string | null;
    primaryContactName: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    stateRegion: string | null;
    postalCode: string | null;
    country: string | null;
  }, billingSettings: { paymentInstructions?: string | null } = {}): Prisma.InputJsonObject {
    return {
      companyId: company.id,
      name: company.name,
      legalName: company.legalName,
      phone: company.phone,
      billingEmail: company.billingEmail,
      primaryContactName: company.primaryContactName,
      addressLine1: company.addressLine1,
      addressLine2: company.addressLine2,
      city: company.city,
      stateRegion: company.stateRegion,
      postalCode: company.postalCode,
      country: company.country,
      taxId: null,
      paymentInstructions: billingSettings.paymentInstructions ?? null
    };
  }

  private buildBillToSnapshot(serviceClient: {
    id: string;
    name: string;
    legalName?: string | null;
    taxId?: string | null;
    billingContactName?: string | null;
    phone?: string | null;
    billingEmail?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    stateRegion?: string | null;
    postalCode?: string | null;
    country?: string | null;
  }): Prisma.InputJsonObject {
    const legalName = serviceClient.legalName?.trim() || null;
    const displayName = legalName || serviceClient.name;

    return {
      serviceClientId: serviceClient.id,
      name: displayName,
      legalName,
      billingContactName: serviceClient.billingContactName ?? null,
      primaryContactName: serviceClient.billingContactName ?? null,
      billingEmail: serviceClient.billingEmail ?? null,
      phone: serviceClient.phone ?? null,
      addressLine1: serviceClient.addressLine1 ?? null,
      addressLine2: serviceClient.addressLine2 ?? null,
      city: serviceClient.city ?? null,
      stateRegion: serviceClient.stateRegion ?? null,
      postalCode: serviceClient.postalCode ?? null,
      country: serviceClient.country ?? null,
      taxId: serviceClient.taxId ?? null
    };
  }

  private addUtcDays(date: Date, days: number) {
    const dueDate = new Date(date);
    dueDate.setUTCDate(dueDate.getUTCDate() + days);
    return dueDate;
  }

  private async generateClientInvoiceNumber(
    tx: Prisma.TransactionClient,
    company: { id: string; groupId: string },
    invoicePrefix: string
  ) {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const prefix = this.normalizeInvoicePrefix(invoicePrefix);
    const rows = await tx.$queryRaw<Array<{ value: number }>>(Prisma.sql`
      INSERT INTO "company_invoice_sequences" ("id", "groupId", "companyId", "sequenceKey", "nextValue", "createdAt", "updatedAt")
      VALUES (${`cis_${randomUUID()}`}, ${company.groupId}, ${company.id}, ${prefix}, 2, NOW(), NOW())
      ON CONFLICT ("companyId", "sequenceKey") DO UPDATE
      SET "nextValue" = "company_invoice_sequences"."nextValue" + 1,
          "updatedAt" = NOW()
      RETURNING "nextValue" - 1 AS value
    `);

    const sequenceValue = rows[0]?.value ?? 1;
    return `${prefix}-${datePart}-${String(sequenceValue).padStart(4, "0")}`;
  }
}
