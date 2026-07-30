"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  formatClientInvoiceNumberLabel,
  type ClientInvoiceListRecord,
} from "../lib/client-invoice-utils";

type IssueClientInvoiceButtonProps = {
  readonly invoice: ClientInvoiceListRecord;
  readonly onIssued?: (() => void) | undefined;
  readonly blockedReason?: string | null | undefined;
};

export function IssueClientInvoiceButton({
  invoice,
  onIssued,
  blockedReason,
}: IssueClientInvoiceButtonProps) {
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (invoice.status !== "DRAFT") {
    return null;
  }

  async function handleIssue() {
    setErrorMessage(null);
    setIsSubmitting(true);

    const response = await fetch(
      `/api/company-operations/client-invoices/${invoice.id}/issue`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
      }
    );

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "No se pudo emitir la factura.");
      return;
    }

    setIsConfirmOpen(false);
    onIssued?.();
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          setErrorMessage(null);
          setIsConfirmOpen(true);
        }}
        disabled={Boolean(blockedReason)}
        title={blockedReason ?? undefined}
        className="stitch-btn-primary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
      >
        Emitir
      </button>
      {blockedReason ? <p className="max-w-xs text-xs font-medium text-error">{blockedReason}</p> : null}

      {isConfirmOpen ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <h3 className="text-sm font-semibold text-on-surface">
            ¿Emitir {formatClientInvoiceNumberLabel(invoice)}?
          </h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            Emitir congela las líneas y totales de la factura. Esto no registra pago ni nómina.
          </p>
          {errorMessage && <p className="mt-2 text-sm text-error">{errorMessage}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleIssue()}
              disabled={isSubmitting}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary disabled:cursor-not-allowed disabled:bg-outline-variant"
            >
              {isSubmitting ? "Emitiendo..." : "Sí, emitir"}
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isSubmitting}
              className="rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-xs font-medium text-on-surface hover:bg-surface-container-low"
            >
              Mantener borrador
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
