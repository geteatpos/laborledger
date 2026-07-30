import {
  Body,
  Controller,
  Inject,
  NotFoundException,
  Param,
  Post
} from "@nestjs/common";

import { PrismaService } from "../identity-access/prisma.service";
import { GroupAccessService } from "../identity-access/group-access.service";
import { resolveEmployeeByPin } from "../worker/worker-auth.helper";

import { AiPartIdService } from "./ai-part-id.service";

type WorkerAiIdentifyBody = {
  companyId?: string;
  pin?: string;
  vin?: string;
  photoId?: string;
};

type WorkerAiApplyBody = {
  companyId?: string;
  pin?: string;
};

@Controller("worker")
export class WorkerAiPartIdController {
  constructor(
    @Inject(AiPartIdService) private readonly aiService: AiPartIdService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GroupAccessService)
    private readonly groupAccessService: GroupAccessService
  ) {}

  @Post("mechanic-orders/:workOrderId/parts/:partId/ai-identify")
  async identifyPart(
    @Param("workOrderId") workOrderId: string,
    @Param("partId") partId: string,
    @Body() body: WorkerAiIdentifyBody
  ) {
    const companyId = this.requireCompanyId(body.companyId);
    await this.groupAccessService.assertCompanyTenantOperational(companyId);
    await resolveEmployeeByPin(this.prisma, companyId, body.pin ?? "");

    await this.requireMechanicOrderOwnership(partId, workOrderId, companyId);

    const trimmedVin = body.vin?.trim() ?? "";
    const trimmedPhotoId = body.photoId?.trim() ?? "";
    if (!trimmedVin) {
      throw new NotFoundException("VIN is required.");
    }
    if (!trimmedPhotoId) {
      throw new NotFoundException("Photo is required.");
    }

    return this.aiService.identifyPart({
      partId,
      companyId,
      vin: trimmedVin,
      photoId: trimmedPhotoId
    });
  }

  @Post("mechanic-orders/:workOrderId/parts/:partId/ai-apply")
  async applySuggestion(
    @Param("workOrderId") workOrderId: string,
    @Param("partId") partId: string,
    @Body() body: WorkerAiApplyBody
  ) {
    const companyId = this.requireCompanyId(body.companyId);
    await this.groupAccessService.assertCompanyTenantOperational(companyId);
    await resolveEmployeeByPin(this.prisma, companyId, body.pin ?? "");

    await this.requireMechanicOrderOwnership(partId, workOrderId, companyId);

    return this.aiService.applySuggestion({ partId, companyId });
  }

  private requireCompanyId(value: string | undefined): string {
    const trimmed = value?.trim() ?? "";
    if (!trimmed) {
      throw new NotFoundException("Company is required.");
    }
    return trimmed;
  }

  private async requireMechanicOrderOwnership(
    partId: string,
    workOrderId: string,
    companyId: string
  ) {
    const part = await this.prisma.mechanicOrderPart.findFirst({
      where: { id: partId, companyId, workOrderId }
    });
    if (!part) {
      throw new NotFoundException("Part not found for this work order and company.");
    }
  }
}
