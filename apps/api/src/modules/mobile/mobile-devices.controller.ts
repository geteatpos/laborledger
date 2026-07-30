import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";

import { AuthenticatedGuard } from "../identity-access/authenticated.guard";
import { CurrentPrincipal } from "../identity-access/current-principal.decorator";
import type { AuthenticatedPrincipal } from "../identity-access/auth.types";
import { CurrentMobileSession } from "./current-mobile-session.decorator";
import { MobileBearerGuard } from "./mobile-bearer.guard";
import type { MobileSessionContext } from "./mobile-contracts";
import { MobileDeviceService } from "./mobile-device.service";
import { optionalDateField, optionalStringField, requireBodyObject, requireIdField } from "./mobile-validation";

@Controller("mobile/devices")
export class MobileDevicesController {
  constructor(@Inject(MobileDeviceService) private readonly mobileDeviceService: MobileDeviceService) {}

  @Post("enrollment-tokens")
  @UseGuards(AuthenticatedGuard)
  @HttpCode(201)
  createEnrollmentToken(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: unknown
  ) {
    const validated = requireBodyObject(body);
    const input: { companyId: string; locationId: string; expiresAt?: string; deviceLabel?: string } = {
      companyId: requireIdField(validated, "companyId"),
      locationId: requireIdField(validated, "locationId")
    };
    const expiresAt = optionalDateField(validated, "expiresAt");
    if (expiresAt !== undefined) input.expiresAt = expiresAt;
    const deviceLabel = optionalStringField(validated, "deviceLabel", 80);
    if (deviceLabel !== undefined) input.deviceLabel = deviceLabel;
    return this.mobileDeviceService.createEnrollmentToken(principal, input);
  }

  @Post("enroll")
  @HttpCode(201)
  enroll(@Body() body: unknown) {
    const validated = requireBodyObject(body);
    const enrollmentToken = typeof validated.enrollmentToken === "string" && validated.enrollmentToken.length <= 256 ? validated.enrollmentToken.trim() : "";
    const androidId = typeof validated.androidId === "string" && validated.androidId.length <= 256 ? validated.androidId.trim() : "";
    const input: { enrollmentToken: string; androidId: string; label?: string } = { enrollmentToken, androidId };
    const label = optionalStringField(validated, "label", 80);
    if (label !== undefined) input.label = label;
    return this.mobileDeviceService.enrollDevice(input);
  }

  @Get()
  @UseGuards(AuthenticatedGuard)
  listDevices(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query("companyId") companyId: string,
    @Query("locationId") locationId?: string
  ) {
    return this.mobileDeviceService.listDevices(principal, companyId, locationId);
  }

  @Get("me")
  @UseGuards(MobileBearerGuard)
  me(@CurrentMobileSession() session: MobileSessionContext) {
    return this.mobileDeviceService.getMyDevice(session.deviceId);
  }

  @Post(":deviceId/revoke")
  @UseGuards(AuthenticatedGuard)
  @HttpCode(200)
  revokeDevice(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("deviceId") deviceId: string,
    @Body() body: unknown
  ) {
    const validated = requireBodyObject(body);
    return this.mobileDeviceService.revokeDevice(principal, deviceId, optionalStringField(validated, "reason", 120));
  }
}
