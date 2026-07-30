import type { ClientInvoiceListRecord, CompanyRecord } from "./client-invoice-utils";
import type { CompanyProfileFormState, CompanyProfileRecord } from "./company-profile-utils";

export const BILLING_SETTINGS_PAGE_TITLE = "Billing Settings";
export const BILLING_SETTINGS_PAGE_DESCRIPTION =
  "Configura el perfil emisor, términos y cobranza de facturas por empresa.";

export type CompanyBillingSettingsRecord = {
  id: string;
  companyId: string;
  groupId: string;
  invoicePrefix: string;
  paymentTermsDays: number;
  defaultNotes: string | null;
  currencyCode: string;
  issuerProfile: CompanyProfileRecord;
  createdAt: string;
  updatedAt: string;
};

export type BillingSummaryRecord = {
  companyId: string;
  outstandingInvoiceCount: number;
  overdueInvoiceCount: number;
  outstandingBalanceMinor: number;
  overdueBalanceMinor: number;
  asOf: string;
};

export type OutstandingInvoiceRecord = ClientInvoiceListRecord & {
  dueDate?: string | null;
  paymentTermsDays?: number | null;
  amountPaidMinor?: number;
  balanceMinor?: number;
  isOverdue?: boolean;
};

export type CompanyDebtorRecord = {
  serviceClient: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
  };
  outstandingInvoiceCount: number;
  overdueInvoiceCount: number;
  outstandingBalanceMinor: number;
  overdueBalanceMinor: number;
  invoices: OutstandingInvoiceRecord[];
};

export type BillingDashboardData = {
  settings: CompanyBillingSettingsRecord;
  summary: BillingSummaryRecord;
  outstandingInvoices: OutstandingInvoiceRecord[];
  debtors: CompanyDebtorRecord[];
};

export type BillingSettingsFormState = CompanyProfileFormState & {
  invoicePrefix: string;
  paymentTermsDays: string;
  defaultNotes: string;
  taxId: string;
  logoUrl: string;
  timezone: string;
};

export type BillingCompletenessIssue = {
  key: keyof BillingSettingsFormState | "tradeName" | "currencyCode";
  label: string;
};

export function billingSettingsApiPath(companyId: string) {
  return `/api/company-operations/companies/${encodeURIComponent(companyId)}/billing-settings`;
}

export function billingDashboardProfile(settings: CompanyBillingSettingsRecord): CompanyProfileRecord {
  return {
    ...settings.issuerProfile,
    currencyCode: settings.currencyCode
  };
}

export function billingSettingsToFormState(
  settings: CompanyBillingSettingsRecord
): BillingSettingsFormState {
  const profile = settings.issuerProfile;
  return {
    legalName: profile.legalName ?? "",
    phone: profile.phone ?? "",
    billingEmail: profile.billingEmail ?? "",
    primaryContactName: profile.primaryContactName ?? "",
    addressLine1: profile.addressLine1 ?? "",
    addressLine2: profile.addressLine2 ?? "",
    city: profile.city ?? "",
    stateRegion: profile.stateRegion ?? "",
    postalCode: profile.postalCode ?? "",
    country: profile.country ?? "",
    invoicePrefix: settings.invoicePrefix ?? "INV",
    paymentTermsDays: String(settings.paymentTermsDays ?? 30),
    defaultNotes: settings.defaultNotes ?? "",
    taxId: "",
    logoUrl: "",
    timezone: ""
  };
}

export function buildBillingSettingsUpdatePayload(form: BillingSettingsFormState) {
  return {
    invoicePrefix: form.invoicePrefix.trim().toUpperCase(),
    paymentTermsDays: Number(form.paymentTermsDays),
    defaultNotes: form.defaultNotes.trim() || null
  };
}

export function validateBillingSettingsForm(
  form: BillingSettingsFormState
): Partial<Record<keyof BillingSettingsFormState, string>> {
  const errors: Partial<Record<keyof BillingSettingsFormState, string>> = {};
  const prefix = form.invoicePrefix.trim().toUpperCase();
  const terms = Number(form.paymentTermsDays);

  if (!/^[A-Z0-9-]{1,12}$/u.test(prefix)) {
    errors.invoicePrefix = "Usa 1-12 letras, números o guiones.";
  }

  if (!Number.isInteger(terms) || terms < 0 || terms > 365) {
    errors.paymentTermsDays = "Usa un número entero entre 0 y 365.";
  }

  if (form.defaultNotes.length > 1000) {
    errors.defaultNotes = "Las instrucciones deben tener 1000 caracteres o menos.";
  }

  return errors;
}

export function getBillingCompletenessIssues(options: {
  company: CompanyRecord;
  settings: CompanyBillingSettingsRecord;
}): BillingCompletenessIssue[] {
  const { company, settings } = options;
  const profile = settings.issuerProfile;
  const required: BillingCompletenessIssue[] = [];

  if (!company.name?.trim()) required.push({ key: "tradeName", label: "Nombre comercial" });
  if (!profile.legalName?.trim()) required.push({ key: "legalName", label: "Nombre legal" });
  if (!profile.addressLine1?.trim()) required.push({ key: "addressLine1", label: "Dirección" });
  if (!profile.city?.trim()) required.push({ key: "city", label: "Ciudad" });
  if (!profile.stateRegion?.trim()) required.push({ key: "stateRegion", label: "Estado / región" });
  if (!profile.postalCode?.trim()) required.push({ key: "postalCode", label: "Código postal" });
  if (!profile.country?.trim()) required.push({ key: "country", label: "País" });
  if (!profile.phone?.trim()) required.push({ key: "phone", label: "Teléfono" });
  if (!profile.billingEmail?.trim()) required.push({ key: "billingEmail", label: "Correo de facturación" });
  if (!settings.currencyCode?.trim()) required.push({ key: "currencyCode", label: "Moneda" });
  if (!settings.invoicePrefix?.trim()) required.push({ key: "invoicePrefix", label: "Prefijo de factura" });
  if (!settings.defaultNotes?.trim()) required.push({ key: "defaultNotes", label: "Instrucciones de pago" });

  return required;
}

export function isInvoiceDueSoon(invoice: OutstandingInvoiceRecord, now = new Date()) {
  if (!invoice.dueDate || invoice.isOverdue) return false;
  const dueDate = new Date(invoice.dueDate);
  if (Number.isNaN(dueDate.getTime())) return false;
  const daysUntilDue = (dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
  return daysUntilDue >= 0 && daysUntilDue <= 7;
}

export function getInvoiceBalanceMinor(invoice: OutstandingInvoiceRecord) {
  return invoice.balanceMinor ?? invoice.totalMinor;
}

export function getDaysPastDue(invoice: OutstandingInvoiceRecord, now = new Date()) {
  if (!invoice.dueDate) return 0;
  const dueDate = new Date(invoice.dueDate);
  if (Number.isNaN(dueDate.getTime()) || dueDate >= now) return 0;
  return Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)));
}
