import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Res, UseGuards } from "@nestjs/common";

import { AuthenticatedGuard } from "../identity-access/authenticated.guard";
import { CurrentPrincipal } from "../identity-access/current-principal.decorator";
import type { AuthenticatedPrincipal } from "../identity-access/auth.types";
import { EmployeePhotoService } from "../employee-photo/employee-photo.service";
import { CurrentMobileSession } from "./current-mobile-session.decorator";
import { MobileAuthService } from "./mobile-auth.service";
import type { ListBadgesQuery } from "./mobile-auth.dto";
import { MobileBearerGuard } from "./mobile-bearer.guard";
import type { MobileSessionContext } from "./mobile-contracts";
import { optionalDateField, optionalIdField, optionalStringField, requireBodyObject, requireIdField, requireStringField } from "./mobile-validation";

type ExpressLikeResponse = NodeJS.WritableStream & {
  setHeader(name: string, value: string | number): void;
};

@Controller("mobile/auth")
export class MobileAuthController {
  constructor(@Inject(MobileAuthService) private readonly mobileAuthService: MobileAuthService) {}

  @Post("login")
  @HttpCode(200)
  login(@Body() body: unknown) {
    const validated = requireBodyObject(body);
    return this.mobileAuthService.login({
      deviceId: requireIdField(validated, "deviceId"),
      badgeUid: requireStringField(validated, "badgeUid", 256),
      pin: requireStringField(validated, "pin", 32)
    });
  }

  @Get("me")
  @UseGuards(MobileBearerGuard)
  me(@CurrentMobileSession() session: MobileSessionContext) {
    return this.mobileAuthService.me(session);
  }

  @Post("logout")
  @UseGuards(MobileBearerGuard)
  @HttpCode(200)
  async logout(@CurrentMobileSession() session: MobileSessionContext) {
    await this.mobileAuthService.logout(session);
    return { ok: true };
  }
}

@Controller("mobile")
export class MobileAdminAuthController {
  constructor(
    @Inject(MobileAuthService) private readonly mobileAuthService: MobileAuthService,
    @Inject(EmployeePhotoService) private readonly employeePhotoService: EmployeePhotoService
  ) {}

  // Unauthenticated by design: the mobile client renders this via a plain
  // <img>/AsyncImage without an Authorization header. The employeeId cuid
  // is the only credential; it is never guessable and grants read-only
  // access to a single headshot image, nothing else.
  @Get("employees/:employeeId/photo")
  async getEmployeePublicPhoto(@Param("employeeId") employeeId: string, @Res() res: ExpressLikeResponse) {
    const result = await this.employeePhotoService.getPublicPhotoStream(employeeId);
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    const stream = await import("node:fs").then((m) => m.createReadStream(result.absolutePath));
    stream.pipe(res);
    return undefined;
  }

  @Post("sessions/:sessionId/revoke")
  @UseGuards(AuthenticatedGuard)
  @HttpCode(200)
  async revokeSession(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("sessionId") sessionId: string,
    @Body() body: unknown
  ) {
    const validated = requireBodyObject(body);
    return this.mobileAuthService.revokeSessionForAdmin(principal, sessionId, optionalStringField(validated, "reason", 120));
  }

  @Post("admin/companies/:companyId/employees/:employeeId/badges/register")
  @UseGuards(AuthenticatedGuard)
  @HttpCode(201)
  registerBadge(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Param("employeeId") employeeId: string,
    @Body() body: unknown
  ) {
    const validated = requireBodyObject(body);
    const input: { locationId: string; badgeUid: string; label?: string; deviceId?: string; expiresAt?: string } = {
      locationId: requireIdField(validated, "locationId"),
      badgeUid: requireStringField(validated, "badgeUid", 256)
    };
    const label = optionalStringField(validated, "label", 80);
    const deviceId = optionalIdField(validated, "deviceId");
    const expiresAt = optionalDateField(validated, "expiresAt");
    if (label !== undefined) input.label = label;
    if (deviceId !== undefined) input.deviceId = deviceId;
    if (expiresAt !== undefined) input.expiresAt = expiresAt;
    return this.mobileAuthService.registerBadge(principal, companyId, employeeId, input);
  }

  @Get("admin/companies/:companyId/badges")
  @UseGuards(AuthenticatedGuard)
  listBadges(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Query() query: ListBadgesQuery
  ) {
    return this.mobileAuthService.listBadges(principal, companyId, query);
  }

  @Post("admin/badges/:badgeCredentialId/revoke")
  @UseGuards(AuthenticatedGuard)
  @HttpCode(200)
  revokeBadge(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("badgeCredentialId") badgeCredentialId: string,
    @Body() body: unknown
  ) {
    const validated = requireBodyObject(body);
    return this.mobileAuthService.revokeBadge(principal, badgeCredentialId, optionalStringField(validated, "reason", 120));
  }
}
