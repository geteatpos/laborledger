import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export {
  DEFAULT_COMPANY_SETTINGS,
  mergeCompanySettings,
  type CompanySettings
} from "./company-settings.js";
