"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  clientInvoiceDisclaimer,
  formatClientInvoiceMoney,
  sumSelectedWorkOrderTotals,
  type CompanyRecord,
  type InvoiceableWorkOrderRecord,
  type ServiceClientRecord
} from "../lib/client-invoice-utils";
import { formatVehicleTitle, type VehicleListRecord } from "../lib/vehicle-utils";
import { formatWorkOrderVehicleSummary } from "../lib/work-order-utils";

export const DEFAULT_VEHICLE_STORAGE_PREFIX = "ll-invoice-default-vehicle:";

type CreateMode = "work_orders" | "manual";

type CreateClientInvoiceFormProps = {
  readonly company: CompanyRecord;
  readonly serviceClients: ServiceClientRecord[];
};

export function CreateClientInvoiceForm({ company, serviceClients }: CreateClientInvoiceFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<CreateMode>("work_orders");
  const [serviceClientId, setServiceClientId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [vehicles, setVehicles] = useState<VehicleListRecord[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [selectedWorkOrderIds, setSelectedWorkOrderIds] = useState<string[]>([]);
  const [invoiceableWorkOrders, setInvoiceableWorkOrders] = useState<InvoiceableWorkOrderRecord[]>([]);
  const [notes, setNotes] = useState("");
  const [isLoadingWorkOrders, setIsLoadingWorkOrders] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeClients = serviceClients.filter((client) => !client.archivedAt);

  const selectedWorkOrders = useMemo(
    () => invoiceableWorkOrders.filter((workOrder) => selectedWorkOrderIds.includes(workOrder.id)),
    [invoiceableWorkOrders, selectedWorkOrderIds]
  );

  const draftTotalMinor = sumSelectedWorkOrderTotals(selectedWorkOrders);
  const currencyCode = selectedWorkOrders[0]?.currencyCode ?? "USD";

  useEffect(() => {
    if (!isOpen || mode !== "work_orders" || !serviceClientId) {
      setInvoiceableWorkOrders([]);
      setSelectedWorkOrderIds([]);
      return;
    }

    let cancelled = false;
    setIsLoadingWorkOrders(true);
    setErrorMessage(null);

    fetch(
      `/api/company-operations/companies/${company.id}/invoiceable-work-orders?serviceClientId=${encodeURIComponent(serviceClientId)}`
    )
      .then(async (response) => {
        const payload = (await response.json().catch(() => [])) as InvoiceableWorkOrderRecord[] | { message?: string };
        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setInvoiceableWorkOrders([]);
          setErrorMessage(
            Array.isArray(payload) ? "Unable to load invoiceable work orders." : (payload.message ?? "Unable to load invoiceable work orders.")
          );
          return;
        }

        setInvoiceableWorkOrders(Array.isArray(payload) ? payload : []);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingWorkOrders(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [company.id, isOpen, mode, serviceClientId]);

  useEffect(() => {
    if (!isOpen || mode !== "manual" || !serviceClientId) {
      setVehicles([]);
      setVehicleId("");
      return;
    }

    let cancelled = false;
    setIsLoadingVehicles(true);

    fetch(
      `/api/company-operations/companies/${company.id}/vehicles?serviceClientId=${encodeURIComponent(serviceClientId)}`
    )
      .then(async (response) => {
        const payload = (await response.json().catch(() => [])) as VehicleListRecord[] | { message?: string };
        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setVehicles([]);
          return;
        }

        const list = Array.isArray(payload) ? payload.filter((vehicle) => !vehicle.archivedAt) : [];
        setVehicles(list);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingVehicles(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [company.id, isOpen, mode, serviceClientId]);

  function toggleWorkOrder(workOrderId: string) {
    setSelectedWorkOrderIds((current) =>
      current.includes(workOrderId)
        ? current.filter((id) => id !== workOrderId)
        : [...current, workOrderId]
    );
  }

  function resetForm() {
    setMode("work_orders");
    setServiceClientId("");
    setVehicleId("");
    setVehicles([]);
    setSelectedWorkOrderIds([]);
    setInvoiceableWorkOrders([]);
    setNotes("");
    setErrorMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!serviceClientId) {
      setErrorMessage("Service client is required.");
      return;
    }

    if (mode === "work_orders" && selectedWorkOrderIds.length === 0) {
      setErrorMessage("Select at least one completed work order.");
      return;
    }

    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/companies/${company.id}/client-invoices`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceClientId,
        workOrderIds: mode === "work_orders" ? selectedWorkOrderIds : [],
        ...(mode === "manual" && vehicleId ? { vehicleId } : {}),
        notes: notes.trim() || undefined
      })
    });

    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      defaultVehicleId?: string | null;
      message?: string;
    };

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "Unable to create draft invoice.");
      return;
    }

    if (payload.id && (payload.defaultVehicleId || vehicleId)) {
      try {
        sessionStorage.setItem(
          `${DEFAULT_VEHICLE_STORAGE_PREFIX}${payload.id}`,
          payload.defaultVehicleId || vehicleId
        );
      } catch {
        // ignore storage failures
      }
    }

    setIsOpen(false);
    resetForm();
    router.refresh();
  }

  if (!isOpen) {
    return (
      <button type="button" onClick={() => setIsOpen(true)} className="stitch-btn-primary">
        Create draft invoice
      </button>
    );
  }

  const canSubmit =
    Boolean(serviceClientId) &&
    (mode === "manual" || selectedWorkOrderIds.length > 0) &&
    !isSubmitting;

  return (
    <form onSubmit={handleSubmit} className="glass-panel rounded-stitch p-5">
      <h2 className="font-display text-headline-md text-on-surface">Create draft invoice</h2>
      <p className="mt-1 text-body-sm text-on-surface-variant">{clientInvoiceDisclaimer()}</p>

      <div className="mt-4 space-y-4">
        <div>
          <p className="stitch-label mb-2">Mode</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("work_orders");
                setVehicleId("");
                setErrorMessage(null);
              }}
              disabled={isSubmitting}
              className={mode === "work_orders" ? "stitch-btn-primary" : "stitch-btn-secondary"}
            >
              From work orders
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("manual");
                setSelectedWorkOrderIds([]);
                setErrorMessage(null);
              }}
              disabled={isSubmitting}
              className={mode === "manual" ? "stitch-btn-primary" : "stitch-btn-secondary"}
            >
              Manual
            </button>
          </div>
          {mode === "manual" ? (
            <p className="mt-2 text-xs text-on-surface-variant">
              Creates an empty draft. Add line items in the invoice editor.
            </p>
          ) : null}
        </div>

        <div>
          <label className="stitch-label mb-2 block" htmlFor="invoice-service-client">
            Service client
          </label>
          <select
            id="invoice-service-client"
            value={serviceClientId}
            onChange={(event) => {
              setServiceClientId(event.target.value);
              setSelectedWorkOrderIds([]);
              setVehicleId("");
            }}
            className="stitch-select"
            disabled={isSubmitting}
          >
            <option value="">Select client</option>
            {activeClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        {mode === "manual" && serviceClientId ? (
          <div>
            <label className="stitch-label mb-2 block" htmlFor="invoice-vehicle">
              Vehicle (optional)
            </label>
            <select
              id="invoice-vehicle"
              value={vehicleId}
              onChange={(event) => setVehicleId(event.target.value)}
              className="stitch-select"
              disabled={isSubmitting || isLoadingVehicles}
            >
              <option value="">{isLoadingVehicles ? "Loading vehicles…" : "No vehicle"}</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {formatVehicleTitle(vehicle)}
                  {vehicle.plate ? ` · ${vehicle.plate}` : ""}
                  {vehicle.vin ? ` · ${vehicle.vin}` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {mode === "work_orders" && serviceClientId ? (
          <div>
            <p className="stitch-label">Completed uninvoiced work orders</p>
            {isLoadingWorkOrders ? (
              <p className="mt-3 text-body-sm text-on-surface-variant">Loading invoiceable work orders…</p>
            ) : invoiceableWorkOrders.length === 0 ? (
              <p className="mt-3 rounded-stitch border border-dashed border-outline-variant-30 bg-surface-container-low px-4 py-3 text-body-sm text-on-surface-variant">
                No completed uninvoiced work orders for this client.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {invoiceableWorkOrders.map((workOrder) => {
                  const checked = selectedWorkOrderIds.includes(workOrder.id);
                  const vehicleSummary = formatWorkOrderVehicleSummary(workOrder.vehicle as VehicleListRecord);

                  return (
                    <li key={workOrder.id}>
                      <label className="flex cursor-pointer gap-3 rounded-stitch border border-outline-variant-30 px-4 py-3 hover:border-primary-30">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleWorkOrder(workOrder.id)}
                          className="mt-1 accent-primary"
                          disabled={isSubmitting}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-body-sm font-medium text-on-surface">
                            {workOrder.workOrderNumber} · {vehicleSummary}
                          </span>
                          <span className="mt-1 block text-xs text-on-surface-variant">
                            {workOrder.serviceLineCount} service
                            {workOrder.serviceLineCount === 1 ? "" : "s"} ·{" "}
                            {formatClientInvoiceMoney(workOrder.totalServiceAmountMinor, workOrder.currencyCode)}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        <div>
          <label className="stitch-label mb-2 block" htmlFor="invoice-notes">
            Notes (optional)
          </label>
          <textarea
            id="invoice-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="stitch-input"
            disabled={isSubmitting}
          />
        </div>

        {mode === "work_orders" && selectedWorkOrders.length > 0 ? (
          <p className="text-body-sm font-medium text-on-surface">
            Draft subtotal: {formatClientInvoiceMoney(draftTotalMinor, currencyCode)} (tax excluded)
          </p>
        ) : null}

        {errorMessage ? <p className="stitch-alert-error">{errorMessage}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={!canSubmit} className="stitch-btn-primary disabled:opacity-50">
            {isSubmitting ? "Creating…" : mode === "manual" ? "Create empty draft" : "Create draft"}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              resetForm();
            }}
            disabled={isSubmitting}
            className="stitch-btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
