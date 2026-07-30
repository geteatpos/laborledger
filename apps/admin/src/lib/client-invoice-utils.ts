import type { CompanyRecord } from "./employee-utils";
import type { ServiceClientRecord } from "./location-utils";

export type ClientInvoiceStatus = "DRAFT" | "ISSUED" | "VOID";

export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CARD";

export type PaymentStatus = "PENDING" | "POSTED" | "VOIDED";

export type ClientInvoicePaymentRecord = {
  id: string;
  clientInvoiceId: string;
  amountMinor: number;
  currencyCode: string;
  paymentDate: string;
  receivedAt: string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference?: string | null;
  notes?: string | null;
  externalPaymentId?: string | null;
  externalProvider?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  createdAt: string;
  recordedByUser?: { id: string; fullName: string | null; email: string } | null;
  voidedByUser?: { id: string; fullName: string | null; email: string } | null;
};

export type LineItemType = "SERVICE" | "PART" | "REPAIR" | "LABOR" | "FEE" | "DISCOUNT" | "OTHER";

export const LINE_ITEM_TYPE_OPTIONS: { value: LineItemType; label: string }[] = [
  { value: "SERVICE", label: "Servicio" },
  { value: "PART", label: "Repuesto" },
  { value: "REPAIR", label: "Reparación" },
  { value: "LABOR", label: "Mano de obra" },
  { value: "FEE", label: "Cargo adicional" },
  { value: "DISCOUNT", label: "Descuento" },
  { value: "OTHER", label: "Otro" }
];

export function formatLineItemTypeLabel(type: LineItemType) {
  return LINE_ITEM_TYPE_OPTIONS.find((t) => t.value === type)?.label ?? type;
}

export type ClientInvoiceLineRecord = {
  id: string;
  workOrderId: string;
  workOrderServiceLineId: string;
  vehicleId: string;
  workOrderNumberSnapshot: string;
  vinSnapshot: string;
  makeSnapshot?: string | null;
  plateSnapshot?: string | null;
  colorSnapshot?: string | null;
  vehicleLabelSnapshot: string | null;
  serviceNameSnapshot: string;
  serviceCategorySnapshot: string | null;
  description: string | null;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  currencyCode: string;
  createdAt: string;
  lineItemType?: LineItemType;
  taxable?: boolean;
  taxRate?: number;
  sortOrder?: number;
};

export type ClientInvoiceDeliveryRecord = {
  id: string;
  channel: string;
  recipientEmail: string;
  subject: string;
  status: "SENT" | "FAILED";
  provider: string;
  providerMessageId: string | null;
  errorMessage: string | null;
  messageNote: string | null;
  sentAt: string | null;
  attemptedAt: string;
  createdAt: string;
  sentByUser?: { id: string; fullName: string | null; email: string } | null;
};

export type ClientInvoicePartySnapshot = {
  name?: string | null;
  legalName?: string | null;
  phone?: string | null;
  billingEmail?: string | null;
  primaryContactName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  postalCode?: string | null;
  country?: string | null;
  taxId?: string | null;
  paymentInstructions?: string | null;
};

export type ClientInvoiceListRecord = {
  id: string;
  companyId?: string;
  serviceClientId?: string;
  invoiceNumber: string | null;
  status: ClientInvoiceStatus;
  serviceClient: { id: string; name: string };
  workOrderCount: number;
  vehicleCount: number;
  lineCount: number;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  amountPaidMinor?: number;
  balanceMinor?: number;
  currencyCode: string;
  dueDate?: string | null;
  paymentTermsDays?: number | null;
  issuerSnapshot?: ClientInvoicePartySnapshot | null;
  billToSnapshot?: ClientInvoicePartySnapshot | null;
  createdAt: string;
  issuedAt: string | null;
  notes?: string | null;
  updatedAt?: string;
  voidedAt?: string | null;
  voidReason?: string | null;
  issuedByUser?: { id: string; fullName: string | null; email: string } | null;
  voidedByUser?: { id: string; fullName: string | null; email: string } | null;
  lines?: ClientInvoiceLineRecord[];
  workOrderIds?: string[];
  deliveries?: ClientInvoiceDeliveryRecord[];
  payments?: ClientInvoicePaymentRecord[];
};

export type InvoiceableWorkOrderRecord = {
  id: string;
  workOrderNumber: string;
  serviceClientId: string;
  vehicle: {
    id: string;
    vin: string;
    year: number | null;
    make: string | null;
    model: string | null;
    plate: string | null;
  };
  serviceLineCount: number;
  totalServiceAmountMinor: number;
  currencyCode: string;
  serviceLines: Array<{
    id: string;
    serviceNameSnapshot: string;
    serviceCategorySnapshot: string | null;
    lineTotalMinor: number;
    currencyCode: string;
  }>;
};

export const CLIENT_INVOICE_STATUS_OPTIONS: ClientInvoiceStatus[] = ["DRAFT", "ISSUED", "VOID"];

export function clientInvoiceDisclaimer() {
  return "Las facturas son documentos orientados al cliente por trabajo de servicio completado. La facturación laboral interna estima costo y cobro desde tiempo aprobado de reloj.";
}

export function formatClientInvoiceStatusLabel(status: ClientInvoiceStatus) {
  if (status === "DRAFT") return "Borrador";
  if (status === "ISSUED") return "Emitida";
  return "Anulada";
}

export function formatClientInvoiceNumberLabel(invoice: Pick<ClientInvoiceListRecord, "invoiceNumber" | "status" | "id">) {
  if (invoice.invoiceNumber) {
    return invoice.invoiceNumber;
  }

  return `Borrador ${invoice.id.slice(0, 8)}`;
}

export function formatClientInvoiceMoney(minorUnits: number, currencyCode = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode
  }).format(minorUnits / 100);
}

export function formatClientInvoiceDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(parsed);
}

export function formatClientInvoiceLineSummary(line: ClientInvoiceLineRecord) {
  const vehicle = line.vehicleLabelSnapshot ?? line.vinSnapshot ?? "—";
  const parts = [line.workOrderNumberSnapshot || null, vehicle].filter(Boolean);
  return parts.join(" · ");
}

export function formatClientInvoiceVehicleDetails(line: ClientInvoiceLineRecord) {
  const details: string[] = [];

  if (line.vehicleLabelSnapshot?.trim()) {
    details.push(line.vehicleLabelSnapshot.trim());
  } else if (line.makeSnapshot?.trim()) {
    details.push(`Marca: ${line.makeSnapshot.trim()}`);
  }

  if (line.colorSnapshot?.trim()) {
    details.push(`Color: ${line.colorSnapshot.trim()}`);
  }

  if (line.vinSnapshot?.trim()) {
    details.push(`VIN: ${line.vinSnapshot.trim()}`);
  }

  if (line.plateSnapshot?.trim()) {
    details.push(`Placa: ${line.plateSnapshot.trim()}`);
  }

  return details;
}

export function pickClientInvoiceVehicle(lines: ClientInvoiceLineRecord[] | undefined) {
  if (!lines?.length) {
    return null;
  }

  const withVehicle = lines.find(
    (line) =>
      Boolean(line.vinSnapshot?.trim()) ||
      Boolean(line.vehicleLabelSnapshot?.trim()) ||
      Boolean(line.plateSnapshot?.trim())
  );

  return withVehicle ?? null;
}

export function resolveInvoiceIssuerSnapshot(
  invoice: Pick<ClientInvoiceListRecord, "issuerSnapshot">,
  fallbackCompanyName: string
) {
  const snapshot = invoice.issuerSnapshot;
  return snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
    ? snapshot
    : { name: fallbackCompanyName };
}

export function resolveInvoiceBillToName(invoice: Pick<ClientInvoiceListRecord, "billToSnapshot" | "serviceClient">) {
  return invoice.billToSnapshot?.name?.trim() || invoice.serviceClient.name;
}

export function formatInvoiceAddressLines(snapshot: ClientInvoicePartySnapshot) {
  const cityState = [snapshot.city?.trim(), snapshot.stateRegion?.trim()].filter(Boolean).join(", ");
  const cityLine = [cityState, snapshot.postalCode?.trim()].filter(Boolean).join(cityState && snapshot.postalCode ? " " : "");
  return [snapshot.addressLine1, snapshot.addressLine2, cityLine, snapshot.country]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line));
}

export function formatInvoicePaymentTerms(paymentTermsDays?: number | null) {
  return typeof paymentTermsDays === "number" ? `Net ${paymentTermsDays}` : "—";
}

export function clientInvoicesEmptyMessage(hasAnyInvoices: boolean) {
  if (hasAnyInvoices) {
    return {
      title: "Ninguna factura coincide con los filtros",
      description: "Prueba otra búsqueda, estado o cliente de servicio."
    };
  }

  return {
    title: "Aún no hay facturas de cliente",
    description:
      "Crea un borrador desde órdenes completadas y sin facturar de un cliente de servicio."
  };
}

export function buildClientInvoiceListQuery(options: {
  serviceClientId?: string;
  status?: ClientInvoiceStatus;
  q?: string;
}) {
  const params = new URLSearchParams();
  if (options.serviceClientId) {
    params.set("serviceClientId", options.serviceClientId);
  }
  if (options.status) {
    params.set("status", options.status);
  }
  if (options.q?.trim()) {
    params.set("q", options.q.trim());
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function sumSelectedWorkOrderTotals(workOrders: InvoiceableWorkOrderRecord[]) {
  return workOrders.reduce((sum, workOrder) => sum + workOrder.totalServiceAmountMinor, 0);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function isValidInvoiceRecipientEmail(email: string) {
  return EMAIL_PATTERN.test(email.trim());
}

export function invoiceEmailSendDisabledCopy(status: ClientInvoiceStatus) {
  if (status === "DRAFT") {
    return "Issue invoice before sending by email.";
  }

  if (status === "VOID") {
    return "Voided invoices cannot be sent.";
  }

  return null;
}

export function formatClientInvoiceDeliveryStatusLabel(status: ClientInvoiceDeliveryRecord["status"]) {
  return status === "SENT" ? "Sent" : "Failed";
}

export function formatClientInvoiceDeliverySummary(delivery: ClientInvoiceDeliveryRecord) {
  const when = formatClientInvoiceDate(delivery.sentAt ?? delivery.attemptedAt);
  const actor = delivery.sentByUser?.fullName ? ` · ${delivery.sentByUser.fullName}` : "";
  return `${delivery.recipientEmail} · ${formatClientInvoiceDeliveryStatusLabel(delivery.status)} · ${when}${actor}`;
}

export function invoicePrintHelperCopy() {
  return "Use your browser print dialog to save as PDF.";
}

export function buildClientInvoicePdfPath(clientInvoiceId: string) {
  return `/api/company-operations/client-invoices/${clientInvoiceId}/pdf`;
}

export function clientInvoicePdfButtonLabel(status: ClientInvoiceStatus) {
  if (status === "DRAFT") {
    return "Download draft PDF";
  }

  return "Download PDF";
}

export function formatPaymentMethodLabel(method: PaymentMethod) {
  if (method === "CASH") return "Efectivo";
  if (method === "BANK_TRANSFER") return "Transferencia";
  return "Tarjeta";
}

export function formatPaymentStatusLabel(status: PaymentStatus) {
  if (status === "PENDING") return "Pendiente";
  if (status === "POSTED") return "Pagada";
  return "Anulada";
}

export function resolvePaymentStatus(
  payments: ClientInvoicePaymentRecord[]
): "PENDING" | "PAID" | "FAILED" | null {
  if (!payments || payments.length === 0) {
    return null;
  }

  const activePayments = payments.filter((p) => p.status !== "VOIDED");
  if (activePayments.length === 0) {
    return "FAILED";
  }

  const hasPosted = activePayments.some((p) => p.status === "POSTED");
  return hasPosted ? "PAID" : "PENDING";
}

export function resolvePaymentMethod(
  payments: ClientInvoicePaymentRecord[]
): PaymentMethod | null {
  if (!payments || payments.length === 0) {
    return null;
  }

  const activePayments = payments.filter((p) => p.status !== "VOIDED");
  if (activePayments.length === 0) {
    return null;
  }

  const firstActive = activePayments[0];
  return firstActive ? firstActive.method : null;
}

export function formatInvoiceCombinedStatus(
  invoiceStatus: ClientInvoiceStatus,
  payments: ClientInvoicePaymentRecord[] | undefined
) {
  const parts: string[] = [];

  if (invoiceStatus === "DRAFT") {
    return { documentStatus: "DRAFT" as const, paymentStatus: null, paymentMethod: null };
  }

  parts.push(invoiceStatus === "ISSUED" ? "Emitida" : "Anulada");

  const activePayments = payments ?? [];
  const paymentStatus = resolvePaymentStatus(activePayments);
  const paymentMethod = resolvePaymentMethod(activePayments);

  if (paymentStatus === "PAID") {
    parts.push("Pagada");
  } else if (paymentStatus === "PENDING") {
    parts.push("Pendiente");
  } else if (paymentStatus === "FAILED") {
    parts.push("Fallida");
  }

  if (paymentMethod) {
    parts.push(formatPaymentMethodLabel(paymentMethod));
  }

  return {
    documentStatus: invoiceStatus,
    paymentStatus,
    paymentMethod,
    combinedLabel: parts.join(" · ")
  };
}

export type { CompanyRecord, ServiceClientRecord };
