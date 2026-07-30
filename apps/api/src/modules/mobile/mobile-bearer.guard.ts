import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";

import type { RequestWithMobileSession } from "./mobile-contracts";
import { MobileSessionService } from "./mobile-session.service";

@Injectable()
export class MobileBearerGuard implements CanActivate {
  constructor(@Inject(MobileSessionService) private readonly mobileSessionService: MobileSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithMobileSession>();
    const authorization = request.headers.authorization;
    const header = Array.isArray(authorization) ? authorization[0] : authorization;

    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Mobile bearer token required.");
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      throw new UnauthorizedException("Mobile bearer token required.");
    }

    request.mobileSession = await this.mobileSessionService.resolveBearerToken(token);
    return true;
  }
}
