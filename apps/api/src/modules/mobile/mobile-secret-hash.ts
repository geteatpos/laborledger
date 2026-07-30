import { createHmac } from "node:crypto";

import { InternalServerErrorException } from "@nestjs/common";

const MOBILE_HASH_PEPPER_ENV = "MOBILE_AUTH_HASH_PEPPER";

function getMobileHashPepper() {
  const pepper = process.env[MOBILE_HASH_PEPPER_ENV];
  if (!pepper || pepper.length < 32) {
    // Fail closed: mobile credential, identifier, and token hashes must be keyed at runtime.
    throw new InternalServerErrorException(`${MOBILE_HASH_PEPPER_ENV} must be configured for mobile credential hashing.`);
  }
  return pepper;
}

export function hashMobileSecret(raw: string, purpose: string) {
  return createHmac("sha256", getMobileHashPepper()).update(`${purpose}:${raw}`).digest("hex");
}

export function mobileHashPrefix(hash: string) {
  return hash.slice(0, 12);
}
