"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  formatClientInvoiceDate,
  formatClientInvoiceMoney,
  formatClientInvoiceNumberLabel,
  type ClientInvoiceListRecord,
  type LineItemType,
  type ServiceClientRecord
} from "../lib/client-invoice-utils";
import { formatVehicleTitle, type VehicleListRecord } from "../lib/vehicle-utils";
import { AddLineItemForm } from "./add-line-item-form";
import { ClientInvoiceLineItemRow, type DraftLineItem } from "./client-invoice-line-item-row";
import { DEFAULT_VEHICLE_STORAGE_PREFIX } from "./create-client-invoice-form";
import { IssueClientInvoiceButton } from "./issue-client-invoice-button";

type ClientInvoiceDraftEditorProps = {
  readonly invoice: ClientInvoiceListRecord;
  readonly companyId: string;
  readonly companyName: string;
  readonly serviceClients: ServiceClientRecord[];
  readonly onUpdated?: (() => void) | undefined;
  readonly issueBlockedReason?: string | null | undefined;
};

type InvoiceLineFromServer = {
  id: string;
  lineItemType?: LineItemType;
  description: string | null;
  quantity: number;
  unitPriceMinor: number;
  taxable?: boolean;
  taxRate?: number;
  lineTotalMinor: number;
  sortOrder?: number;
};

export function ClientInvoiceDraftEditor({
  invoice,
  companyId,
  serviceClients,
  onUpdated,
  issueBlockedReason
}: ClientInvoiceDraftEditorProps) {
  const [localLines, setLocalLines] = useState<DraftLineItem[]>([]);
  const [serviceClientId, setServiceClientId] = useState(invoice.serviceClient?.id ?? "");
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [dueDate, setDueDate] = useState(invoice.dueDate ?? "");
  const [vehicleId, setVehicleId] = useState("");
  const [vehicles, setVehicles] = useState<VehicleListRecord[]>([]);
  const [isLoadingLines, setIsLoadingLines] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`${DEFAULT_VEHICLE_STORAGE_PREFIX}${invoice.id}`);
      if (stored) {
        setVehicleId(stored);
      }
    } catch {
      // ignore
    }
  }, [invoice.id]);

  useEffect(() => {
    if (!serviceClientId || !companyId) {
      setVehicles([]);
      return;
    }

    let cancelled = false;
    fetch(
      `/api/company-operations/companies/${companyId}/vehicles?serviceClientId=${encodeURIComponent(serviceClientId)}`
    )
      .then(async (response) => {
        const payload = (await response.json().catch(() => [])) as VehicleListRecord[];
        if (cancelled || !response.ok || !Array.isArray(payload)) {
          return;
        }
        setVehicles(payload.filter((vehicle) => !vehicle.archivedAt));
      })
      .catch(() => {
        if (!cancelled) setVehicles([]);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, serviceClientId]);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingLines(true);

    fetch(`/api/company-operations/client-invoices/${invoice.id}`)
      .then(async (response) => {
        if (cancelled) return;
        const payload = (await response.json().catch(() => ({}))) as ClientInvoiceListRecord & {
          lines?: InvoiceLineFromServer[];
          message?: string;
        };
        if (!response.ok) {
          setErrorMessage(payload.message ?? "No se pudo cargar la factura.");
          return;
        }

        const fetchedLines: DraftLineItem[] = (payload.lines ?? []).map((l): DraftLineItem => {
          const line: DraftLineItem = {
            id: l.id,
            type: l.lineItemType ?? "SERVICE",
            description: l.description ?? "",
            quantity: l.quantity,
            unitPriceMinor: l.unitPriceMinor,
            taxable: l.taxable ?? false,
            taxRate: l.taxRate ?? 0
          };
          if (l.sortOrder !== undefined) {
            line.sortOrder = l.sortOrder;
          }
          return line;
        });

        if (!cancelled) {
          setLocalLines(fetchedLines);
          setServiceClientId(payload.serviceClient?.id ?? serviceClientId);
          setNotes(payload.notes ?? "");
          setDueDate(payload.dueDate ?? "");
        }
      })
      .catch(() => {
        if (!cancelled) setErrorMessage("Error de red al cargar la factura.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingLines(false);
      });

    return () => {
      cancelled = true;
    };
  }, [invoice.id]);

  const activeClients = serviceClients.filter((c) => !c.archivedAt);

  const subtotalMinor = localLines.reduce(
    (sum, line) => sum + line.quantity * line.unitPriceMinor,
    0
  );
  const taxMinor = localLines.reduce(
    (sum, line) => (line.taxable ? sum + Math.round((line.quantity * line.unitPriceMinor * line.taxRate) / 100) : sum),
    0
  );
  const totalMinor = subtotalMinor + taxMinor;
  const balanceMinor = typeof invoice.balanceMinor === "number" ? invoice.balanceMinor : totalMinor;

  async function handleSaveDraft(event?: FormEvent<HTMLFormElement>) {
    if (event) event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (localLines.length === 0) {
      // Empty manual drafts can still save client/notes/due date.
    }

    setIsSaving(true);

    try {
      const updateResponse = await fetch(
        `/api/company-operations/client-invoices/${invoice.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            serviceClientId,
            notes: notes.trim() || null,
            dueDate: dueDate || null
          })
        }
      );

      if (!updateResponse.ok) {
        const err = (await updateResponse.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? "No se pudo guardar el borrador.");
      }

      setSuccessMessage("Borrador guardado exitosamente.");
      setTimeout(() => setSuccessMessage(null), 3000);
      onUpdated?.();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "No se pudo guardar el borrador.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddLine(newLine: DraftLineItem) {
    setErrorMessage(null);

    const response = await fetch(
      `/api/company-operations/client-invoices/${invoice.id}/lines`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: newLine.type,
          description: newLine.description,
          quantity: newLine.quantity,
          unitPriceMinor: newLine.unitPriceMinor,
          taxable: newLine.taxable,
          taxRate: newLine.taxRate,
          ...(vehicleId ? { vehicleId } : {})
        })
      }
    );

    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      lines?: Array<{ id: string; description: string | null }>;
      message?: string;
    };

    if (!response.ok) {
      setErrorMessage(payload.message ?? "No se pudo agregar el concepto.");
      return;
    }

    const createdLineId =
      payload.lines?.find((line) => line.description === newLine.description)?.id ??
      payload.lines?.[payload.lines.length - 1]?.id ??
      payload.id ??
      `temp-${Date.now()}`;

    setLocalLines((prev) => [...prev, { ...newLine, id: createdLineId }]);
    onUpdated?.();
  }

  async function handleUpdateLine(lineId: string, updatedLine: DraftLineItem) {
    setErrorMessage(null);

    const response = await fetch(
      `/api/company-operations/client-invoices/${invoice.id}/lines/${lineId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: updatedLine.type,
          description: updatedLine.description,
          quantity: updatedLine.quantity,
          unitPriceMinor: updatedLine.unitPriceMinor,
          taxable: updatedLine.taxable,
          taxRate: updatedLine.taxRate
        })
      }
    );

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    if (!response.ok) {
      setErrorMessage(payload.message ?? "No se pudo actualizar el concepto.");
      return;
    }

    setLocalLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...updatedLine, id: lineId } : l))
    );
  }

  async function handleDeleteLine(lineId: string) {
    if (!window.confirm("¿Eliminar este concepto?")) return;
    setErrorMessage(null);

    const response = await fetch(
      `/api/company-operations/client-invoices/${invoice.id}/lines/${lineId}`,
      {
        method: "DELETE"
      }
    );

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    if (!response.ok) {
      setErrorMessage(payload.message ?? "No se pudo eliminar el concepto.");
      return;
    }

    setLocalLines((prev) => prev.filter((l) => l.id !== lineId));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="stitch-badge-neutral">Borrador</span>
          <span className="text-sm text-on-surface-variant">
            {formatClientInvoiceNumberLabel(invoice)}
          </span>
          <span className="text-xs text-outline">·</span>
          <span className="text-xs text-on-surface-variant">
            Creada {formatClientInvoiceDate(invoice.createdAt)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleSaveDraft()}
            disabled={isSaving}
            className="stitch-btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
          >
            {isSaving ? "Guardando…" : "Guardar borrador"}
          </button>
          <IssueClientInvoiceButton
            invoice={invoice}
            blockedReason={issueBlockedReason}
            onIssued={onUpdated}
          />
        </div>
      </div>

      {successMessage ? (
        <div className="rounded-lg border border-success/30 bg-success-container/20 px-4 py-2">
          <p className="text-sm text-success">{successMessage}</p>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-lg border border-error/30 bg-error-container/20 px-4 py-2">
          <p className="text-sm text-error">{errorMessage}</p>
        </div>
      ) : null}

      <form onSubmit={handleSaveDraft} className="space-y-5">
        <div className="grid gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:grid-cols-2">
          <div>
            <label className="stitch-label mb-1.5 block" htmlFor="draft-client">
              Cliente
            </label>
            <select
              id="draft-client"
              value={serviceClientId}
              onChange={(e) => setServiceClientId(e.target.value)}
              className="stitch-select"
              disabled={isSaving}
            >
              <option value="">Seleccionar cliente</option>
              {activeClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="stitch-label mb-1.5 block" htmlFor="draft-due-date">
              Fecha de vencimiento
            </label>
            <input
              id="draft-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="stitch-input"
              disabled={isSaving}
            />
          </div>

          <div>
            <label className="stitch-label mb-1.5 block" htmlFor="draft-vehicle">
              Vehículo (líneas nuevas)
            </label>
            <select
              id="draft-vehicle"
              value={vehicleId}
              onChange={(e) => {
                setVehicleId(e.target.value);
                try {
                  if (e.target.value) {
                    sessionStorage.setItem(`${DEFAULT_VEHICLE_STORAGE_PREFIX}${invoice.id}`, e.target.value);
                  } else {
                    sessionStorage.removeItem(`${DEFAULT_VEHICLE_STORAGE_PREFIX}${invoice.id}`);
                  }
                } catch {
                  // ignore
                }
              }}
              className="stitch-select"
              disabled={isSaving}
            >
              <option value="">Sin vehículo</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {formatVehicleTitle(vehicle)}
                  {vehicle.plate ? ` · ${vehicle.plate}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="stitch-label mb-1.5 block" htmlFor="draft-notes">
              Notas
            </label>
            <textarea
              id="draft-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="stitch-input text-sm"
              placeholder="Notas visibles en la factura…"
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest">
          <div className="border-b border-outline-variant px-4 py-3">
            <h3 className="text-sm font-semibold text-on-surface">Conceptos</h3>
            <p className="text-xs text-on-surface-variant">
              Agrega servicios, repuestos, reparaciones y otros conceptos manualmente.
            </p>
          </div>

          {isLoadingLines ? (
            <div className="flex items-center justify-center gap-3 py-8 text-on-surface-variant">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-on-surface-variant/30 border-t-on-surface-variant" />
              <span className="text-sm">Cargando conceptos…</span>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-surface-container-low text-left">
                    <tr>
                      <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                        Tipo
                      </th>
                      <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                        Descripción
                      </th>
                      <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                        Cant.
                      </th>
                      <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                        P. Unit.
                      </th>
                      <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                        Impuesto
                      </th>
                      <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                        Subtotal
                      </th>
                      <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {localLines.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-on-surface-variant">
                          Sin conceptos. Agrega uno para continuar.
                        </td>
                      </tr>
                    ) : (
                      localLines.map((line) => (
                        <ClientInvoiceLineItemRow
                          key={line.id ?? `new-${line.sortOrder}`}
                          line={line}
                          currencyCode={invoice.currencyCode}
                          onSave={(updated) => {
                            if (line.id) {
                              void handleUpdateLine(line.id, updated);
                            }
                          }}
                          onDelete={() => {
                            if (line.id) {
                              void handleDeleteLine(line.id);
                            }
                          }}
                          disabled={isSaving}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-outline-variant p-4">
                <AddLineItemForm
                  currencyCode={invoice.currencyCode}
                  onAdd={handleAddLine}
                  disabled={isSaving}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end">
          <div className="w-full max-w-sm space-y-2 rounded-xl bg-primary-container px-4 py-4 text-on-primary">
            <div className="flex justify-between text-sm text-on-primary/75">
              <span>Subtotal</span>
              <span>{formatClientInvoiceMoney(subtotalMinor, invoice.currencyCode)}</span>
            </div>
            <div className="flex justify-between text-sm text-on-primary/75">
              <span>Impuesto</span>
              <span>{formatClientInvoiceMoney(taxMinor, invoice.currencyCode)}</span>
            </div>
            <div className="flex justify-between border-t border-on-primary/20 pt-2 text-lg font-bold">
              <span>Total</span>
              <span>{formatClientInvoiceMoney(totalMinor, invoice.currencyCode)}</span>
            </div>
            {invoice.status === "ISSUED" && (
              <>
                <div className="flex justify-between text-sm text-on-primary/75">
                  <span>Pagado</span>
                  <span>
                    {formatClientInvoiceMoney(
                      typeof invoice.amountPaidMinor === "number" ? invoice.amountPaidMinor : 0,
                      invoice.currencyCode
                    )}
                  </span>
                </div>
                <div className="flex justify-between border-t border-on-primary/20 pt-2 text-lg font-bold">
                  <span>Balance</span>
                  <span>{formatClientInvoiceMoney(balanceMinor, invoice.currencyCode)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
