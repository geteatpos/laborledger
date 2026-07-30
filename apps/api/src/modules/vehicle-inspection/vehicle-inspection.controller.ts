import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ChecklistItemStatus } from "@prisma/client";

import type { AuthenticatedPrincipal } from "../identity-access/auth.types";
import { CurrentPrincipal } from "../identity-access/current-principal.decorator";
import { AuthenticatedGuard } from "../identity-access/authenticated.guard";
import { GroupAccessService } from "../identity-access/group-access.service";
import { PrismaService } from "../identity-access/prisma.service";
import { resolveEmployeeByPin } from "../worker/worker-auth.helper";

import { VehicleInspectionService } from "./vehicle-inspection.service";

type WorkerChecklistAuthBody = {
  companyId?: string;
  pin?: string;
};

type WorkerChecklistCreateBody = WorkerChecklistAuthBody & {
  workOrderId?: string;
};

type WorkerChecklistItemPatchBody = WorkerChecklistAuthBody & {
  status?: ChecklistItemStatus;
  notes?: string;
  measurementValue?: number;
  measurementUnit?: string;
};

type AdminChecklistListQuery = {
  offset?: string;
  limit?: string;
};

@Controller("worker")
export class WorkerVehicleInspectionController {
  constructor(
    @Inject(VehicleInspectionService)
    private readonly inspectionService: VehicleInspectionService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GroupAccessService)
    private readonly groupAccessService: GroupAccessService
  ) {}

  @Post("checklist")
  createChecklist(@Body() body: WorkerChecklistCreateBody) {
    return this.runForWorker(body, () =>
      this.inspectionService.createWorkerChecklist({
        companyId: body.companyId ?? "",
        workOrderId: body.workOrderId ?? ""
      })
    );
  }

  @Get("checklist/:checklistId")
  getChecklist(
    @Param("checklistId") checklistId: string,
    @Query() query: WorkerChecklistAuthBody
  ) {
    return this.runForWorker(query, () =>
      this.inspectionService.getWorkerChecklist(checklistId, query.companyId ?? "")
    );
  }

  @Patch("checklist/:checklistId/items/:itemId")
  patchChecklistItem(
    @Param("checklistId") checklistId: string,
    @Param("itemId") itemId: string,
    @Body() body: WorkerChecklistItemPatchBody
  ) {
    return this.runForWorker(body, () =>
      this.inspectionService.updateWorkerChecklistItem(checklistId, itemId, {
        companyId: body.companyId ?? "",
        status: body.status as ChecklistItemStatus,
        notes: body.notes,
        measurementValue: body.measurementValue,
        measurementUnit: body.measurementUnit
      })
    );
  }

  @Post("checklist/:checklistId/complete")
  completeChecklist(
    @Param("checklistId") checklistId: string,
    @Body() body: WorkerChecklistAuthBody
  ) {
    return this.runForWorker(body, () =>
      this.inspectionService.completeWorkerChecklist(
        checklistId,
        body.companyId ?? ""
      )
    );
  }

  private async runForWorker<T>(
    body: WorkerChecklistAuthBody,
    fn: () => Promise<T>
  ): Promise<T> {
    const companyId = body.companyId?.trim() ?? "";
    if (!companyId) {
      throw new NotFoundException("Company is required.");
    }

    await this.groupAccessService.assertCompanyTenantOperational(companyId);
    await resolveEmployeeByPin(this.prisma, companyId, body.pin ?? "");

    return fn();
  }
}

@Controller("company-operations")
@UseGuards(AuthenticatedGuard)
export class AdminVehicleInspectionController {
  constructor(
    @Inject(VehicleInspectionService)
    private readonly inspectionService: VehicleInspectionService
  ) {}

  @Get("companies/:companyId/checklists")
  listCompanyChecklists(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Query() query: AdminChecklistListQuery
  ) {
    const offset = query.offset ? Number.parseInt(query.offset, 10) : 0;
    const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined;

    return this.inspectionService.listAdminChecklists(principal, {
      companyId,
      offset: Number.isFinite(offset) ? offset : 0,
      limit: Number.isFinite(limit as number) ? (limit as number) : undefined
    });
  }

  @Get("work-orders/:workOrderId/checklist")
  getWorkOrderChecklist(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("workOrderId") workOrderId: string
  ) {
    return this.inspectionService.getAdminChecklistByWorkOrder(
      principal,
      workOrderId
    );
  }

  @Get("companies/:companyId/checklists/:checklistId")
  getCompanyChecklist(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Param("checklistId") checklistId: string
  ) {
    return this.inspectionService.getAdminChecklist(principal, companyId, checklistId);
  }
}
