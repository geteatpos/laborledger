"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ArchiveVehicleButtonProps = {
  readonly vehicleId: string;
  readonly vehicleLabel: string;
  readonly isArchived: boolean;
  readonly onStatusChange?: () => void;
  /** Smaller control for table/list actions */
  readonly compact?: boolean;
};

export function ArchiveVehicleButton({
  vehicleId,
  vehicleLabel,
  isArchived,
  onStatusChange,
  compact = false
}: ArchiveVehicleButtonProps) {
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleConfirm() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const endpoint = isArchived
      ? `/api/company-operations/vehicles/${vehicleId}/unarchive`
      : `/api/company-operations/vehicles/${vehicleId}/archive`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" }
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "No se pudo actualizar el estado del vehículo.");
      return;
    }

    setSuccessMessage(
      isArchived
        ? `${vehicleLabel} quedó activo otra vez.`
        : `${vehicleLabel} se desactivó.`
    );
    setIsConfirmOpen(false);
    onStatusChange?.();
    router.refresh();
  }

  const actionLabel = isArchived ? "Reactivar" : "Desactivar";
  const confirmTitle = isArchived ? "¿Reactivar vehículo?" : "¿Desactivar vehículo?";
  const confirmBody = isArchived
    ? `${vehicleLabel} volverá a aparecer en listas activas y se podrá usar en recepción.`
    : `${vehicleLabel} se ocultará de las listas activas. No se borra del historial (órdenes y facturas quedan intactas). Puedes reactivarlo después.`;

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <button
        type="button"
        onClick={() => {
          setErrorMessage(null);
          setIsConfirmOpen(true);
        }}
        className={
          compact
            ? isArchived
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100"
              : "rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
            : isArchived
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
              : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
        }
      >
        {actionLabel}
      </button>

      {successMessage && !isConfirmOpen ? (
        <p className="text-xs text-emerald-700">{successMessage}</p>
      ) : null}

      {isConfirmOpen ? (
        <div
          className={
            compact
              ? "fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/30 p-4"
              : "rounded-xl border border-slate-200 bg-slate-50 p-4"
          }
          role="dialog"
          aria-labelledby={`archive-vehicle-${vehicleId}`}
        >
          <div
            className={
              compact
                ? "w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-lg"
                : undefined
            }
          >
            <h3 id={`archive-vehicle-${vehicleId}`} className="text-sm font-semibold text-slate-900">
              {confirmTitle}
            </h3>
            <p className="mt-1 text-sm text-slate-600">{confirmBody}</p>
            {errorMessage ? <p className="mt-2 text-sm text-red-600">{errorMessage}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSubmitting ? "Guardando…" : `Sí, ${actionLabel.toLowerCase()}`}
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isSubmitting}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
