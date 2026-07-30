"use client";

import { ClientInvoicePaymentsPanel } from "./client-invoice-payments-panel";
import { ClientInvoicePrintView } from "./client-invoice-print-view";
import { ClientInvoiceStatusBadge } from "./client-invoice-status-badge";
import { DownloadInvoicePdfButton } from "./download-invoice-pdf-button";
import { IssueClientInvoiceButton } from "./issue-client-invoice-button";
import { MaterialIcon } from "./ui/material-icon";
import { PrintInvoiceButton } from "./print-invoice-button";
import { SendClientInvoiceEmailButton } from "./send-client-invoice-email-button";
import { VoidClientInvoiceButton } from "./void-client-invoice-button";
import {
  clientInvoiceDisclaimer,
  formatClientInvoiceDate,
  formatClientInvoiceDeliverySummary,
  type ClientInvoiceListRecord
} from "../lib/client-invoice-utils";

type ClientInvoiceDetailPanelProps = {
  readonly invoice: ClientInvoiceListRecord;
  readonly companyName: string;
  readonly onUpdated?: (() => void) | undefined;
  readonly layout?: "preview" | "drawer";
  readonly issueBlockedReason?: string | null | undefined;
};

export function ClientInvoiceDetailPanel({
  invoice,
  companyName,
  onUpdated,
  layout = "preview",
  issueBlockedReason
}: ClientInvoiceDetailPanelProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ClientInvoiceStatusBadge status={invoice.status} />
          <span className="text-xs text-on-surface-variant">
            Creada {formatClientInvoiceDate(invoice.createdAt)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintInvoiceButton invoiceId={invoice.id} />
          <DownloadInvoicePdfButton invoice={invoice} />
          <SendClientInvoiceEmailButton
            invoice={invoice}
            {...(onUpdated ? { onSent: onUpdated } : {})}
          />
          <IssueClientInvoiceButton
            invoice={invoice}
            blockedReason={issueBlockedReason}
            {...(onUpdated ? { onIssued: onUpdated } : {})}
          />
          <VoidClientInvoiceButton
            invoice={invoice}
            {...(onUpdated ? { onVoided: onUpdated } : {})}
          />
        </div>
      </div>

      <div
        className={
          layout === "preview"
            ? "overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-card"
            : ""
        }
      >
        <ClientInvoicePrintView invoice={invoice} companyName={companyName} />
      </div>

      <p className="text-xs leading-relaxed text-on-surface-variant">{clientInvoiceDisclaimer()}</p>

      <ClientInvoicePaymentsPanel invoice={invoice} onUpdated={onUpdated} />

      {invoice.deliveries && invoice.deliveries.length > 0 ? (
        <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <h3 className="stitch-label inline-flex items-center gap-1.5">
            <MaterialIcon name="outgoing_mail" className="text-[16px]" />
            Historial de envío
          </h3>
          <ul className="mt-3 space-y-2">
            {invoice.deliveries.map((delivery) => (
              <li key={delivery.id} className="text-xs text-on-surface-variant">
                <p>{formatClientInvoiceDeliverySummary(delivery)}</p>
                {delivery.errorMessage ? (
                  <p className="mt-0.5 text-error">{delivery.errorMessage}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
