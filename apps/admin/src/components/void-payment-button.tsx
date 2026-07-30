"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  formatClientInvoiceDate,
  formatClientInvoiceMoney,
  formatPaymentMethodLabel,
  type ClientInvoicePaymentRecord
} from "../lib/client-invoice-utils";
import { MaterialIcon } from "./ui/material-icon";

type VoidPaymentButtonProps = {
  readonly invoiceId: string;
  readonly payment: ClientInvoicePaymentRecord;
  readonly onVoided?: () => void;
};

export function VoidPaymentButton({ invoiceId, payment, onVoided }: VoidPaymentButtonProps) {
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleVoid() {
    const reason = voidReason.trim();
    if (!reason) {
      setErrorMessage("El motivo de anulación es requerido.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const response = await fetch(
      `/api/company-operations/client-invoices/${invoiceId}/payments/${payment.id}/void`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voidReason: reason })
      }
    );

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "No se pudo anular el pago.");
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
        className="stitch-btn-danger px-2 py-1 text-xs"
      >
        <MaterialIcon name="cancel" className="text-[14px]" />
        Anular
      </button>

      {isConfirmOpen ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <h4 className="text-sm font-semibold text-on-surface">
            ¿Anular pago de {formatPaymentMethodLabel(payment.method)}?
          </h4>
          <p className="mt-1 text-xs text-on-surface-variant">
            {formatClientInvoiceMoney(payment.amountMinor, payment.currencyCode)} ·{" "}
            {formatClientInvoiceDate(payment.paymentDate)}
          </p>
          <p className="mt-2 text-xs text-on-surface-variant">
            Anular el pago volverá a dejar la factura como pendiente.
          </p>
          <label
            className="mt-3 block text-xs font-medium text-on-surface-variant"
            htmlFor={`void-payment-reason-${payment.id}`}
          >
            Motivo de anulación
          </label>
          <textarea
            id={`void-payment-reason-${payment.id}`}
            value={voidReason}
            onChange={(event) => setVoidReason(event.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface"
            disabled={isSubmitting}
          />
          {errorMessage && <p className="mt-2 text-sm text-error">{errorMessage}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleVoid()}
              disabled={isSubmitting}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary disabled:cursor-not-allowed disabled:bg-outline-variant"
            >
              {isSubmitting ? "Guardando…" : "Sí, anular"}
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isSubmitting}
              className="rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-xs font-medium text-on-surface hover:bg-surface-container-low"
            >
              Mantener pago
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
