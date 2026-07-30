import { createHmac } from "node:crypto";

const MOBILE_HASH_PEPPER_ENV = "MOBILE_AUTH_HASH_PEPPER";

export function hashMobileSecret(raw: string, purpose: string): string {
  const pepper = process.env[MOBILE_HASH_PEPPER_ENV];
  return createHmac("sha256", pepper ?? "default-dev-pepper")
    .update(`${purpose}:${raw}`)
    .digest("hex");
}
