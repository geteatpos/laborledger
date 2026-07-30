import { BadRequestException, Body, Controller, Get, Headers, Inject, Post, Query, UseGuards } from "@nestjs/common";

import { KioskPunchService } from "../kiosk/kiosk-punch.service";

import { FieldBootstrapService } from "./field-bootstrap.service";
import type { FieldBootstrapResponse } from "./field-bootstrap.types";
import { FieldServiceAuthGuard } from "./field-service-auth.guard";

type FieldClockLookupBody = {
  companyId?: string;
  locationId?: string;
  pin?: string;
};

type FieldClockPunchBody = FieldClockLookupBody & {
  action?: string;
  idempotencyKey?: string;
};

@Controller("field")
export class FieldBootstrapController {
  constructor(
    @Inject(FieldBootstrapService) private readonly fieldBootstrapService: FieldBootstrapService,
    @Inject(KioskPunchService) private readonly kioskPunchService: KioskPunchService
  ) {}

  @Get("bootstrap")
  async bootstrap(
    @Headers("x-field-host") fieldHostHeader: string | undefined,
    @Headers("host") hostHeader: string | undefined,
    @Query("hostname") hostnameQuery?: string
  ): Promise<FieldBootstrapResponse> {
    const hostname = hostnameQuery?.trim() || fieldHostHeader?.trim() || hostHeader?.trim() || "";
    return this.fieldBootstrapService.resolveByHostname(hostname);
  }

  @Post("clock/lookup")
  @UseGuards(FieldServiceAuthGuard)
  async clockLookup(@Body() body: FieldClockLookupBody) {
    const companyId = body.companyId?.trim() ?? "";
    const locationId = body.locationId?.trim() ?? "";
    const pin = body.pin ?? "";

    const kiosk = await this.fieldBootstrapService.resolveKioskForLocation(companyId, locationId);
    return this.kioskPunchService.lookup(kiosk, { pin });
  }

  @Post("clock/punch")
  @UseGuards(FieldServiceAuthGuard)
  async clockPunch(@Body() body: FieldClockPunchBody) {
    const companyId = body.companyId?.trim() ?? "";
    const locationId = body.locationId?.trim() ?? "";
    const pin = body.pin ?? "";

    const kiosk = await this.fieldBootstrapService.resolveKioskForLocation(companyId, locationId);
    return this.kioskPunchService.processPunch(kiosk, {
      pin,
      action: body.action ?? "",
      idempotencyKey: body.idempotencyKey ?? ""
    });
  }

  @Get("shifts/my")
  @UseGuards(FieldServiceAuthGuard)
  async getMyShifts(
    @Query("employeeId") employeeId: string,
    @Query("locationId") locationId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined
  ) {
    if (!employeeId?.trim()) {
      throw new BadRequestException("employeeId is required.");
    }
    if (!locationId?.trim()) {
      throw new BadRequestException("locationId is required.");
    }
    return this.fieldBootstrapService.getEmployeeShifts(
      employeeId.trim(),
      locationId.trim(),
      from?.trim(),
      to?.trim()
    );
  }
}
