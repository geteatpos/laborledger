"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  formatClientInvoiceNumberLabel,
  type ClientInvoiceListRecord,
} from "../lib/client-invoice-utils";

type VoidClientInvoiceButtonProps = {
  readonly invoice: ClientInvoiceListRecord;
  readonly onVoided?: (() => void) | undefined;
};

export function VoidClientInvoiceButton({
  invoice,
  onVoided,
}: VoidClientInvoiceButtonProps) {
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (invoice.status !== "ISSUED") {
    return null;
  }

  async function handleVoid() {
    const reason = voidReason.trim();
    if (!reason) {
      setErrorMessage("El motivo de anulación es requerido.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const response = await fetch(
      `/api/company-operations/client-invoices/${invoice.id}/void`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voidReason: reason }),
      }
    );

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "No se pudo anular la factura.");
      return;
    }

    setIsConfirmOpen(false);
    setVoidReason("");
    onVoided?.();
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
        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
        Anular factura
      </button>

      {isConfirmOpen ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">
            ¿Anular {formatClientInvoiceNumberLabel(invoice)}?
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Anular mantiene el registro de la factura para auditoría y libera las órdenes de trabajo
            vinculadas para facturar en el futuro.
          </p>
          <label
            className="mt-3 block text-xs font-medium text-slate-600"
            htmlFor={`void-reason-${invoice.id}`}
          >
            Motivo de anulación
          </label>
          <textarea
            id={`void-reason-${invoice.id}`}
            value={voidReason}
            onChange={(event) => setVoidReason(event.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            disabled={isSubmitting}
          />
          {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleVoid()}
              disabled={isSubmitting}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Guardando..." : "Sí, anular"}
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Mantener emitida
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
