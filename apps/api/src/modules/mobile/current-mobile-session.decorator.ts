import { createParamDecorator, ExecutionContext } from "@nestjs/common";

import type { MobileSessionContext, RequestWithMobileSession } from "./mobile-contracts";

export const CurrentMobileSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): MobileSessionContext | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithMobileSession>();
    return request.mobileSession;
  }
);
