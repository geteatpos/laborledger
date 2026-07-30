import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import type { MechanicOrderPart } from "@prisma/client";

import { AuthenticatedGuard } from "../identity-access/authenticated.guard";
import { type AuthenticatedPrincipal } from "../identity-access/auth.types";
import { CompanyScopeService } from "../identity-access/company-scope.service";
import { CurrentPrincipal } from "../identity-access/current-principal.decorator";
import { GroupAccessService } from "../identity-access/group-access.service";
import { PrismaService } from "../identity-access/prisma.service";
import { resolveEmployeeByPin } from "../worker/worker-auth.helper";

import { MechanicOrderService } from "./mechanic-order.service";
import { AiShoppingService } from "../ai-shopping/ai-shopping.service";

type WorkerCreateMechanicOrderBody = {
  companyId?: string;
  pin?: string;
  workOrderId?: string;
};

type WorkerPartAuthBody = {
  companyId?: string;
  pin?: string;
};

type WorkerAddPartBody = WorkerPartAuthBody & {
  name?: string;
  quantity?: number;
  notes?: string | null;
  photoId?: string | null;
};

type WorkerUpdatePartBody = WorkerPartAuthBody & {
  name?: string;
  quantity?: number;
  notes?: string | null;
  photoId?: string | null;
};

type WorkerAuthQuery = {
  companyId?: string;
  pin?: string;
};

type WorkerMarkNotificationReadBody = {
  companyId?: string;
  pin?: string;
};

@Controller("worker")
export class WorkerMechanicOrderController {
  constructor(
    @Inject(MechanicOrderService) private readonly service: MechanicOrderService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GroupAccessService)
    private readonly groupAccessService: GroupAccessService
  ) {}

  @Post("mechanic-orders")
  async createMechanicOrder(@Body() body: WorkerCreateMechanicOrderBody) {
    const companyId = this.requireCompanyId(body.companyId);
    const workOrderId = this.requireWorkOrderId(body.workOrderId);
    await this.groupAccessService.assertCompanyTenantOperational(companyId);
    await resolveEmployeeByPin(this.prisma, companyId, body.pin ?? "");
    return this.service.createMechanicOrder({ companyId, workOrderId });
  }

  @Get("mechanic-orders/:workOrderId")
  async getMechanicOrder(
    @Param("workOrderId") workOrderId: string,
    @Query() query: WorkerAuthQuery
  ) {
    const companyId = this.requireCompanyId(query.companyId);
    await this.groupAccessService.assertCompanyTenantOperational(companyId);
    await resolveEmployeeByPin(this.prisma, companyId, query.pin ?? "");
    return this.service.getMechanicOrder(workOrderId, companyId);
  }

  @Post("mechanic-orders/:workOrderId/parts")
  async addPart(
    @Param("workOrderId") workOrderId: string,
    @Body() body: WorkerAddPartBody
  ): Promise<MechanicOrderPart> {
    const companyId = this.requireCompanyId(body.companyId);
    await this.groupAccessService.assertCompanyTenantOperational(companyId);
    await resolveEmployeeByPin(this.prisma, companyId, body.pin ?? "");
    return this.service.addPart({
      companyId,
      workOrderId,
      name: body.name,
      quantity: body.quantity,
      notes: body.notes,
      photoId: body.photoId
    });
  }

  @Patch("mechanic-orders/:workOrderId/parts/:partId")
  async updatePart(
    @Param("workOrderId") _workOrderId: string,
    @Param("partId") partId: string,
    @Body() body: WorkerUpdatePartBody
  ): Promise<MechanicOrderPart> {
    const companyId = this.requireCompanyId(body.companyId);
    await this.groupAccessService.assertCompanyTenantOperational(companyId);
    await resolveEmployeeByPin(this.prisma, companyId, body.pin ?? "");
    return this.service.updatePart(partId, companyId, {
      name: body.name,
      quantity: body.quantity,
      notes: body.notes,
      photoId: body.photoId
    });
  }

  @Delete("mechanic-orders/:workOrderId/parts/:partId")
  async deletePart(
    @Param("workOrderId") _workOrderId: string,
    @Param("partId") partId: string,
    @Body() body: WorkerPartAuthBody
  ) {
    const companyId = this.requireCompanyId(body.companyId);
    await this.groupAccessService.assertCompanyTenantOperational(companyId);
    await resolveEmployeeByPin(this.prisma, companyId, body.pin ?? "");
    return this.service.deletePart(partId, companyId);
  }

  @Get("notifications")
  async getNotifications(@Query() query: WorkerAuthQuery) {
    const companyId = this.requireCompanyId(query.companyId);
    await this.groupAccessService.assertCompanyTenantOperational(companyId);
    const employee = await resolveEmployeeByPin(this.prisma, companyId, query.pin ?? "");
    return this.service.getNotificationsForEmployee({
      companyId,
      employeeId: employee.id
    });
  }

  @Post("notifications/:notificationId/read")
  async markNotificationRead(
    @Param("notificationId") notificationId: string,
    @Body() body: WorkerMarkNotificationReadBody
  ) {
    const companyId = this.requireCompanyId(body.companyId);
    await this.groupAccessService.assertCompanyTenantOperational(companyId);
    const employee = await resolveEmployeeByPin(this.prisma, companyId, body.pin ?? "");
    return this.service.markNotificationRead({
      companyId,
      notificationId,
      employeeId: employee.id
    });
  }

  private requireCompanyId(value: string | undefined): string {
    const trimmed = value?.trim() ?? "";
    if (!trimmed) {
      throw new NotFoundException("Company is required.");
    }
    return trimmed;
  }

  private requireWorkOrderId(value: string | undefined): string {
    const trimmed = value?.trim() ?? "";
    if (!trimmed) {
      throw new NotFoundException("Work order is required.");
    }
    return trimmed;
  }
}

type AdminDecisionBody = {
  note?: string;
  contactMethod?: string;
};

@Controller("company-operations")
@UseGuards(AuthenticatedGuard)
export class AdminMechanicOrderController {
  constructor(
    @Inject(MechanicOrderService) private readonly service: MechanicOrderService,
    @Inject(CompanyScopeService)
    private readonly companyScopeService: CompanyScopeService,
    @Inject(AiShoppingService) private readonly aiShoppingService: AiShoppingService
  ) {}

  @Get(":companyId/mechanic-orders")
  listMechanicOrders(
    @Param("companyId") companyId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query("status") status?: string
  ) {
    const statusFilter =
      status === "APPROVED" || status === "REJECTED" || status === "ALL" || status === "PENDING"
        ? status
        : "PENDING";
    return this.service.listMechanicOrders(companyId, principal, statusFilter);
  }

  @Get(":companyId/mechanic-orders/:workOrderId")
  async getMechanicOrder(
    @Param("companyId") companyId: string,
    @Param("workOrderId") workOrderId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal
  ) {
    await this.companyScopeService.getCompanyAccessContext(principal, companyId);
    return this.service.getMechanicOrder(workOrderId, companyId);
  }

  @Post(":companyId/mechanic-orders/:workOrderId/approve")
  approveOrder(
    @Param("companyId") companyId: string,
    @Param("workOrderId") workOrderId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: AdminDecisionBody
  ) {
    return this.service.approveOrder({
      companyId,
      workOrderId,
      supervisorUserId: principal.userId,
      note: body.note,
      contactMethod: body.contactMethod
    });
  }

  @Post(":companyId/mechanic-orders/:workOrderId/reject")
  rejectOrder(
    @Param("companyId") companyId: string,
    @Param("workOrderId") workOrderId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: AdminDecisionBody
  ) {
    if (!body.note?.trim()) {
      throw new NotFoundException("Rejection note is required.");
    }
    const note = body.note.trim();
    return this.service.rejectOrder({
      companyId,
      workOrderId,
      supervisorUserId: principal.userId,
      note,
      contactMethod: body.contactMethod
    });
  }

  @Get(":companyId/mechanic-orders/:workOrderId/parts/:partId/shopping-links")
  getShoppingLinks(
    @Param("companyId") companyId: string,
    @Param("workOrderId") workOrderId: string,
    @Param("partId") partId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal
  ) {
    void principal;
    return this.aiShoppingService.buildShoppingLinksForPart({
      companyId,
      workOrderId,
      partId
    });
  }

  @Post(":companyId/mechanic-orders/:workOrderId/parts/:partId/ai-identify")
  async identifyPartWithAi(
    @Param("companyId") companyId: string,
    @Param("workOrderId") workOrderId: string,
    @Param("partId") partId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: AiIdentifyBody
  ) {
    await this.companyScopeService.getCompanyAccessContext(principal, companyId);
    return this.aiShoppingService.identifyAndPersist({
      partId,
      companyId,
      workOrderId,
      vin: body.vin,
      photoId: body.photoId
    });
  }
}

type AiIdentifyBody = {
  vin?: string;
  photoId?: string;
};
