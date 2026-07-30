"use client";

import {
  formatInvoiceCombinedStatus,
  type ClientInvoiceListRecord
} from "../lib/client-invoice-utils";
import { ClientInvoiceDocumentBadge } from "./client-invoice-status-badge";
import { PaymentMethodBadge } from "./payment-method-badge";

type ClientInvoiceCombinedStatusProps = {
  readonly invoice: ClientInvoiceListRecord;
};

export function ClientInvoiceCombinedStatus({ invoice }: ClientInvoiceCombinedStatusProps) {
  const { documentStatus, paymentStatus, paymentMethod } = formatInvoiceCombinedStatus(
    invoice.status,
    invoice.payments
  );

  if (invoice.status === "DRAFT") {
    return <ClientInvoiceDocumentBadge status="DRAFT" />;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ClientInvoiceDocumentBadge status={documentStatus} />
      {paymentStatus === "PAID" && (
        <span className="stitch-badge-success">Pagada</span>
      )}
      {paymentStatus === "PENDING" && (
        <span className="stitch-badge-warning">Pendiente</span>
      )}
      {paymentStatus === "FAILED" && (
        <span className="stitch-badge-danger">Fallida</span>
      )}
      {paymentMethod && <PaymentMethodBadge method={paymentMethod} />}
    </div>
  );
}
