import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";

import { PrismaService } from "./identity-access/prisma.service";

@Controller("health")
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        service: "api",
        status: "degraded",
        database: "unavailable"
      });
    }

    return {
      service: "api",
      status: "ok",
      database: "ok"
    };
  }
}
