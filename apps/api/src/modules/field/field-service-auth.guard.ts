import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";

@Injectable()
export class FieldServiceAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();

    const configuredSecret = process.env.FIELD_SERVICE_SECRET?.trim() ?? "";
    if (!configuredSecret) {
      throw new UnauthorizedException("Field service is not configured.");
    }

    const provided = this.readHeader(request.headers["x-field-service-secret"]);
    if (!provided) {
      throw new UnauthorizedException("Field service credentials are required.");
    }

    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(configuredSecret);
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException("Field service credentials are invalid.");
    }

    return true;
  }

  private readHeader(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
      return value[0]?.trim() ?? "";
    }

    return value?.trim() ?? "";
  }
}
