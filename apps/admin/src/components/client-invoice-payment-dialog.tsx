"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import {
  formatClientInvoiceMoney,
  formatClientInvoiceNumberLabel,
  type ClientInvoiceListRecord
} from "../lib/client-invoice-utils";
import { MaterialIcon } from "./ui/material-icon";

type MarkAsPaidDialogProps = {
  readonly invoice: ClientInvoiceListRecord;
  readonly onPaid?: () => void;
};

export function MarkAsPaidDialog({ invoice, onPaid }: MarkAsPaidDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [method, setMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const balanceMinor =
    typeof invoice.balanceMinor === "number" ? invoice.balanceMinor : invoice.totalMinor;

  function openDialog() {
    setErrorMessage(null);
    setMethod("CASH");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setReference("");
    setNotes("");
    setIsOpen(true);
  }

  function closeDialog() {
    if (!isSubmitting) {
      setIsOpen(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (method === "BANK_TRANSFER" && !reference.trim()) {
      setErrorMessage("La referencia es obligatoria para transferencias.");
      return;
    }

    setIsSubmitting(true);

    const response = await fetch(
      `/api/company-operations/client-invoices/${invoice.id}/payments`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          method,
          amountMinor: balanceMinor,
          paymentDate,
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined
        })
      }
    );

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "No se pudo registrar el pago.");
      return;
    }

    setIsOpen(false);
    onPaid?.();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="stitch-btn-primary px-3 py-1.5 text-xs"
      >
        <MaterialIcon name="payments" className="text-[16px]" />
        Marcar como pagada
      </button>

      {isOpen ? (
        <>
          <button
            type="button"
            aria-label="Cerrar diálogo"
            className="stitch-modal-overlay"
            onClick={closeDialog}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="stitch-modal w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-5 py-3">
                <div className="flex items-center gap-2">
                  <MaterialIcon name="payments" className="text-[20px] text-secondary" />
                  <p className="text-sm font-semibold text-on-surface">Registrar pago</p>
                </div>
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded-lg p-1.5 hover:bg-surface-container-low"
                  disabled={isSubmitting}
                >
                  <MaterialIcon name="close" className="text-[18px]" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5">
                <div className="mb-4 rounded-xl border border-outline-variant bg-surface-container-low/50 p-4">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <dt className="text-on-surface-variant">Factura</dt>
                    <dd className="font-semibold text-on-surface">
                      {formatClientInvoiceNumberLabel(invoice)}
                    </dd>
                    <dt className="text-on-surface-variant">Cliente</dt>
                    <dd className="font-semibold text-on-surface">
                      {invoice.serviceClient.name}
                    </dd>
                    <dt className="text-on-surface-variant">Balance</dt>
                    <dd className="font-bold text-secondary">
                      {formatClientInvoiceMoney(balanceMinor, invoice.currencyCode)}
                    </dd>
                    <dt className="text-on-surface-variant">Moneda</dt>
                    <dd className="text-on-surface">{invoice.currencyCode}</dd>
                  </dl>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="stitch-label mb-1.5 block">Método de pago</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setMethod("CASH")}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition ${
                          method === "CASH"
                            ? "border-secondary bg-secondary-container/20 text-secondary"
                            : "border-outline-variant text-on-surface-variant hover:border-secondary/40"
                        }`}
                      >
                        💵 Efectivo
                      </button>
                      <button
                        type="button"
                        onClick={() => setMethod("BANK_TRANSFER")}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition ${
                          method === "BANK_TRANSFER"
                            ? "border-secondary bg-secondary-container/20 text-secondary"
                            : "border-outline-variant text-on-surface-variant hover:border-secondary/40"
                        }`}
                      >
                        🏦 Transferencia
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="stitch-label mb-1.5 block" htmlFor="payment-date">
                      Fecha de recepción
                    </label>
                    <input
                      id="payment-date"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="stitch-input"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label
                      className="stitch-label mb-1.5 block"
                      htmlFor={`payment-reference-${invoice.id}`}
                    >
                      Referencia{" "}
                      {method === "BANK_TRANSFER" ? (
                        <span className="text-error">*</span>
                      ) : (
                        <span className="text-on-surface-variant">(opcional)</span>
                      )}
                    </label>
                    <input
                      id={`payment-reference-${invoice.id}`}
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder={
                        method === "BANK_TRANSFER"
                          ? "Número de referencia de transferencia"
                          : "Para efectivos, dejar en blanco"
                      }
                      className="stitch-input"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label
                      className="stitch-label mb-1.5 block"
                      htmlFor={`payment-notes-${invoice.id}`}
                    >
                      Nota <span className="text-on-surface-variant">(opcional)</span>
                    </label>
                    <textarea
                      id={`payment-notes-${invoice.id}`}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="stitch-input text-sm"
                      placeholder="Notas adicionales sobre el pago…"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {errorMessage ? (
                  <p className="mt-4 stitch-alert-error text-sm">{errorMessage}</p>
                ) : null}

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeDialog}
                    disabled={isSubmitting}
                    className="stitch-btn-secondary px-4 py-2"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="stitch-btn-primary px-4 py-2"
                  >
                    {isSubmitting ? "Guardando…" : "Confirmar pago"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
