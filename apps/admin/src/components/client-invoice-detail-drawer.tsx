"use client";

import { useEffect, useState } from "react";

import { ClientInvoiceStatusBadge } from "./client-invoice-status-badge";
import { IssueClientInvoiceButton } from "./issue-client-invoice-button";
import { PrintInvoiceButton } from "./print-invoice-button";
import { DownloadInvoicePdfButton } from "./download-invoice-pdf-button";
import { SendClientInvoiceEmailButton } from "./send-client-invoice-email-button";
import { VoidClientInvoiceButton } from "./void-client-invoice-button";
import {
  clientInvoiceDisclaimer,
  formatClientInvoiceDate,
  formatClientInvoiceDeliverySummary,
  formatClientInvoiceMoney,
  formatClientInvoiceNumberLabel,
  formatClientInvoiceVehicleDetails,
  pickClientInvoiceVehicle,
  type ClientInvoiceListRecord,
} from "../lib/client-invoice-utils";

type ClientInvoiceDetailDrawerProps = {
  readonly invoiceId: string | null;
  readonly companyName: string;
  readonly onClose: () => void;
  readonly onUpdated?: () => void;
};

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="stitch-label mb-3">{children}</h3>
  );
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return <div className="glass-panel rounded-stitch p-4">{children}</div>;
}

function MoneyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 text-body-sm">
      <span className="text-on-surface-variant">{label}</span>
      <span className="font-medium text-on-surface">{value}</span>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center gap-3 py-8 text-on-surface-variant">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-on-surface-variant/30 border-t-on-surface-variant" />
      <span className="text-sm">Cargando detalles...</span>
    </div>
  );
}

export function ClientInvoiceDetailDrawer({
  invoiceId,
  companyName,
  onClose,
  onUpdated,
}: ClientInvoiceDetailDrawerProps) {
  const [invoice, setInvoice] = useState<ClientInvoiceListRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  function reloadInvoice() {
    setReloadToken((value) => value + 1);
    onUpdated?.();
  }

  useEffect(() => {
    if (!invoiceId) {
      setInvoice(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    fetch(`/api/company-operations/client-invoices/${invoiceId}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as ClientInvoiceListRecord & {
          message?: string;
        };

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setInvoice(null);
          setErrorMessage(payload.message ?? "No se pudo cargar los detalles de la factura.");
          return;
        }

        setInvoice(payload);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [invoiceId, reloadToken]);

  if (!invoiceId) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar detalles de factura"
        className="stitch-drawer-overlay"
        onClick={onClose}
      />

      <aside
        className="stitch-drawer"
        role="dialog"
        aria-labelledby="client-invoice-detail-title"
      >
        <div className="flex items-center justify-between border-b border-outline-variant-20 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="client-invoice-detail-title"
              className="truncate font-display text-base font-semibold text-on-surface"
            >
              {invoice ? formatClientInvoiceNumberLabel(invoice) : "Detalle de factura"}
            </h2>
            <p className="text-xs text-on-surface-variant">{companyName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="stitch-btn-ghost"
            aria-label="Cerrar"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {isLoading && <LoadingSpinner />}
          {errorMessage && <div className="stitch-alert-error">{errorMessage}</div>}

          {invoice ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <ClientInvoiceStatusBadge status={invoice.status} />
                <span className="text-xs text-on-surface-variant">
                  Creada {formatClientInvoiceDate(invoice.createdAt)}
                </span>
              </div>

              <section>
                <SectionHeader>Cliente</SectionHeader>
                <InfoCard>
                  <p className="font-medium text-on-surface">{invoice.serviceClient.name}</p>
                  <p className="mt-2 text-xs text-on-surface-variant">
                    {invoice.workOrderCount} orden{invoice.workOrderCount === 1 ? "" : "es"} de
                    trabajo · {invoice.vehicleCount} vehículo
                    {invoice.vehicleCount === 1 ? "" : "s"}
                  </p>
                  {invoice.issuedAt && (
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Emitida {formatClientInvoiceDate(invoice.issuedAt)}
                      {invoice.issuedByUser?.fullName
                        ? ` · ${invoice.issuedByUser.fullName}`
                        : ""}
                    </p>
                  )}
                  {invoice.voidedAt && (
                    <p className="mt-1 text-xs text-red-400">
                      Anulada {formatClientInvoiceDate(invoice.voidedAt)}
                      {invoice.voidReason ? ` · ${invoice.voidReason}` : ""}
                    </p>
                  )}
                </InfoCard>
              </section>

              {(() => {
                const invoiceVehicle = pickClientInvoiceVehicle(invoice.lines);
                if (!invoiceVehicle) {
                  return null;
                }
                const vehicleDetails = formatClientInvoiceVehicleDetails(invoiceVehicle);
                return (
                  <section>
                    <SectionHeader>Vehículo</SectionHeader>
                    <InfoCard>
                      {invoiceVehicle.workOrderNumberSnapshot ? (
                        <p className="text-xs text-on-surface-variant">
                          Orden: {invoiceVehicle.workOrderNumberSnapshot}
                        </p>
                      ) : null}
                      {vehicleDetails.length > 0 ? (
                        <ul className="mt-1 space-y-0.5 text-sm text-on-surface">
                          {vehicleDetails.map((detail) => (
                            <li key={detail}>{detail}</li>
                          ))}
                        </ul>
                      ) : null}
                    </InfoCard>
                  </section>
                );
              })()}

              <section>
                <SectionHeader>Líneas de factura</SectionHeader>
                <InfoCard>
                  {invoice.lines && invoice.lines.length > 0 ? (
                    <ul className="space-y-4">
                      {invoice.lines.map((line) => (
                        <li
                          key={line.id}
                          className="border-b border-outline-variant-20 pb-4 last:border-b-0 last:pb-0"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-body-sm font-medium text-on-surface">
                                {line.serviceNameSnapshot}
                              </p>
                              {line.description?.trim() ? (
                                <p className="mt-1 text-xs text-on-surface-variant">
                                  {line.description.trim()}
                                </p>
                              ) : null}
                              <p className="mt-1 text-xs text-on-surface-variant">
                                Cant. {line.quantity} ·{" "}
                                {formatClientInvoiceMoney(line.unitPriceMinor, line.currencyCode)}
                              </p>
                            </div>
                            <p className="shrink-0 text-body-sm font-semibold text-primary">
                              {formatClientInvoiceMoney(line.lineTotalMinor, line.currencyCode)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-on-surface-variant">Sin líneas</p>
                  )}
                  <div className="mt-4 border-t border-outline-variant-20 pt-3">
                    <MoneyRow
                      label="Subtotal"
                      value={formatClientInvoiceMoney(invoice.subtotalMinor, invoice.currencyCode)}
                    />
                    <MoneyRow
                      label="Impuesto"
                      value={formatClientInvoiceMoney(invoice.taxMinor, invoice.currencyCode)}
                    />
                    <MoneyRow
                      label="Total"
                      value={formatClientInvoiceMoney(invoice.totalMinor, invoice.currencyCode)}
                    />
                  </div>
                </InfoCard>
              </section>

              <section>
                <SectionHeader>Notas</SectionHeader>
                <p className="glass-panel rounded-stitch p-4 text-body-sm text-on-surface-variant">
                  {invoice.notes?.trim() || "Sin notas."}
                </p>
              </section>

              <section>
                <SectionHeader>Acciones</SectionHeader>
                <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
                  {clientInvoiceDisclaimer()}
                </p>
                <div className="flex flex-wrap gap-2">
                  <PrintInvoiceButton invoiceId={invoice.id} />
                  <DownloadInvoicePdfButton invoice={invoice} />
                  <SendClientInvoiceEmailButton invoice={invoice} onSent={reloadInvoice} />
                  <IssueClientInvoiceButton invoice={invoice} onIssued={onClose} />
                  <VoidClientInvoiceButton invoice={invoice} onVoided={onClose} />
                </div>
              </section>

              {invoice.deliveries && invoice.deliveries.length > 0 && (
                <section>
                  <SectionHeader>Historial de envío por email</SectionHeader>
                  <ul className="glass-panel space-y-3 rounded-stitch p-4">
                    {invoice.deliveries.map((delivery) => (
                      <li key={delivery.id} className="text-xs text-on-surface-variant">
                        <p>{formatClientInvoiceDeliverySummary(delivery)}</p>
                        {delivery.errorMessage && (
                          <p className="mt-0.5 text-red-400">{delivery.errorMessage}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
