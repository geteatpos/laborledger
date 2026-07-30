import { Module } from "@nestjs/common";

import { AuthenticatedGuard } from "../identity-access/authenticated.guard";
import { CompanyScopeService } from "../identity-access/company-scope.service";
import { GroupAccessService } from "../identity-access/group-access.service";
import { PrismaService } from "../identity-access/prisma.service";
import { MobileAdminAuthController, MobileAuthController } from "./mobile-auth.controller";
import { MobileAuthService } from "./mobile-auth.service";
import { MobileAuditService } from "./mobile-audit.service";
import { MobileBearerGuard } from "./mobile-bearer.guard";
import { MobileDeviceService } from "./mobile-device.service";
import { MobileDevicesController } from "./mobile-devices.controller";
import { MobileRateLimitService } from "./mobile-rate-limit.service";
import { MobileSessionService } from "./mobile-session.service";

@Module({
  controllers: [MobileAuthController, MobileAdminAuthController, MobileDevicesController],
  providers: [
    PrismaService,
    AuthenticatedGuard,
    CompanyScopeService,
    GroupAccessService,
    MobileAuditService,
    MobileRateLimitService,
    MobileSessionService,
    MobileDeviceService,
    MobileAuthService,
    MobileBearerGuard
  ],
  exports: [MobileSessionService, MobileBearerGuard]
})
export class MobileModule {}
