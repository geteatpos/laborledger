import { Injectable, OnModuleInit, InternalServerErrorException } from "@nestjs/common";
import { createHmac } from "node:crypto";

import { mobileHashPrefix } from "./mobile-secret-hash";

const MOBILE_HASH_PEPPER_ENV = "MOBILE_AUTH_HASH_PEPPER";

@Injectable()
export class MobileConfigService implements OnModuleInit {
  private pepper: string | null = null;

  onModuleInit() {
    const pepper = process.env[MOBILE_HASH_PEPPER_ENV];
    if (!pepper || pepper.length < 32) {
      throw new InternalServerErrorException(
        `${MOBILE_HASH_PEPPER_ENV} must be at least 32 characters.`
      );
    }
    this.pepper = pepper;
  }

  private getPepper(): string {
    if (!this.pepper) {
      throw new InternalServerErrorException(
        `${MOBILE_HASH_PEPPER_ENV} is not initialized.`
      );
    }
    return this.pepper;
  }

  hashSecret(raw: string, purpose: string): string {
    return createHmac("sha256", this.getPepper())
      .update(`${purpose}:${raw}`)
      .digest("hex");
  }

  prefix(hash: string): string {
    return mobileHashPrefix(hash);
  }
}
