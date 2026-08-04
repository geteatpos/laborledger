"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { formatEmployeeDate } from "../lib/employee-utils";
import type { LocationRecord } from "../lib/location-utils";
import { MaterialIcon } from "./ui/material-icon";

type BadgeRecord = {
  id: string;
  locationId: string;
  deviceId: string | null;
  label: string | null;
  lockedUntil: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  provisionedAt: string;
};

type NfcCardSectionProps = {
  readonly employeeId: string;
  readonly employeeName: string;
  readonly companyId: string;
  readonly disabled?: boolean;
  readonly onBadgeChange?: () => void;
};

export function NfcCardSection({
  employeeId,
  employeeName,
  companyId,
  disabled = false,
  onBadgeChange
}: NfcCardSectionProps) {
  const router = useRouter();
  const [badge, setBadge] = useState<BadgeRecord | null>(null);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [badgeUid, setBadgeUid] = useState("");
  const [label, setLabel] = useState("");
  const [locationId, setLocationId] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const [locationHasNoActiveDevice, setLocationHasNoActiveDevice] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      const [badgeResponse, locationsResponse] = await Promise.all([
        fetch(`/api/mobile/admin/badges?companyId=${companyId}&employeeId=${employeeId}`, {
          cache: "no-store"
        }),
        fetch(`/api/company-operations/companies/${companyId}/locations`, { cache: "no-store" })
      ]);

      if (cancelled) {
        return;
      }

      const badgePayload = await badgeResponse.json().catch(() => ({}));
      const locationsPayload = await locationsResponse.json().catch(() => []);

      if (cancelled) {
        return;
      }

      setIsLoading(false);

      if (!badgeResponse.ok) {
        setLoadError(
          (badgePayload as { message?: string }).message ?? "No se pudo cargar la tarjeta NFC."
        );
        return;
      }

      const badges = Array.isArray(badgePayload) ? (badgePayload as BadgeRecord[]) : [];
      setBadge(badges[0] ?? null);
      setLocations(Array.isArray(locationsPayload) ? (locationsPayload as LocationRecord[]) : []);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [employeeId, companyId]);

  useEffect(() => {
    if (!isFormOpen || !locationId) {
      setLocationHasNoActiveDevice(false);
      return;
    }

    let cancelled = false;

    async function checkLocationDevices() {
      try {
        const response = await fetch(
          `/api/mobile/devices?companyId=${companyId}&locationId=${locationId}`,
          { cache: "no-store" }
        );
        if (cancelled || !response.ok) {
          return;
        }
        const payload = await response.json().catch(() => []);
        const devices = Array.isArray(payload) ? payload : [];
        if (!cancelled) {
          setLocationHasNoActiveDevice(devices.length === 0);
        }
      } catch {
        // Best-effort warning only; a failed check should not block the form.
      }
    }

    void checkLocationDevices();

    return () => {
      cancelled = true;
    };
  }, [isFormOpen, locationId, companyId]);

  const activeLocations = locations.filter((location) => !location.archivedAt);
  const locationName = badge
    ? locations.find((location) => location.id === badge.locationId)?.name ?? "Ubicación desconocida"
    : null;

  function openForm() {
    setIsFormOpen(true);
    setBadgeUid("");
    setLabel("");
    setLocationId(activeLocations[0]?.id ?? "");
    setFieldError(null);
    setSubmitError(null);
    setSuccessMessage(null);
  }

  function closeForm() {
    setIsFormOpen(false);
    setFieldError(null);
    setSubmitError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const trimmedUid = badgeUid.trim();
    if (!trimmedUid) {
      setFieldError("Ingresa el número de la tarjeta.");
      return;
    }
    if (!locationId) {
      setFieldError("Selecciona una ubicación.");
      return;
    }

    setFieldError(null);
    setIsSubmitting(true);

    const previousBadgeId = badge?.id ?? null;

    try {
      const response = await fetch("/api/mobile/admin/badges", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyId,
          employeeId,
          locationId,
          badgeUid: trimmedUid,
          label: label.trim() || undefined
        })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setSubmitError((payload as { message?: string }).message ?? "No se pudo asignar la tarjeta.");
        return;
      }

      setBadge(payload as BadgeRecord);
      setIsFormOpen(false);
      setSuccessMessage(
        previousBadgeId ? "Tarjeta actualizada correctamente." : "Tarjeta asignada correctamente."
      );
      onBadgeChange?.();
      router.refresh();

      if (previousBadgeId) {
        // Best-effort: retire the previous credential now that the new one is confirmed active,
        // so a rejected replacement never leaves the employee without working access.
        void fetch(`/api/mobile/admin/badges/${previousBadgeId}/revoke`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: "Reemplazada por nueva tarjeta" })
        });
      }
    } catch {
      setSubmitError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRevoke() {
    if (!badge) {
      return;
    }

    setIsRevoking(true);
    setRevokeError(null);

    try {
      const response = await fetch(`/api/mobile/admin/badges/${badge.id}/revoke`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "Desvinculada por administrador" })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setRevokeError((payload as { message?: string }).message ?? "No se pudo desvincular la tarjeta.");
        return;
      }

      setBadge(null);
      setShowRevokeConfirm(false);
      setSuccessMessage("Tarjeta desvinculada.");
      onBadgeChange?.();
      router.refresh();
    } catch {
      setRevokeError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsRevoking(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-on-surface-variant">Cargando…</p>;
  }

  if (loadError) {
    return <p className="text-sm text-error">{loadError}</p>;
  }

  return (
    <div className="space-y-3">
      {!badge && !isFormOpen ? (
        <div className="flex flex-col items-center gap-2 py-3 text-center">
          <MaterialIcon name="nfc" className="text-[28px] text-on-surface-variant" />
          <p className="text-sm text-on-surface-variant">Sin tarjeta asignada</p>
          <button
            type="button"
            onClick={openForm}
            disabled={disabled}
            className="stitch-btn-primary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            Asignar tarjeta
          </button>
        </div>
      ) : null}

      {badge && !isFormOpen ? (
        <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-3">
          <div className="flex items-center gap-2">
            <MaterialIcon name="nfc" className="text-[18px] text-primary" filled />
            <p className="text-sm font-medium text-on-surface">{badge.label?.trim() || "Tarjeta NFC"}</p>
          </div>
          <dl className="mt-2 space-y-1 text-xs text-on-surface-variant">
            <div className="flex justify-between gap-2">
              <dt>Asignada</dt>
              <dd>{formatEmployeeDate(badge.provisionedAt)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Ubicación</dt>
              <dd>{locationName}</dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openForm}
              disabled={disabled}
              className="stitch-btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cambiar tarjeta
            </button>
            <button
              type="button"
              onClick={() => setShowRevokeConfirm(true)}
              disabled={disabled}
              className="stitch-btn-ghost px-3 py-1.5 text-xs text-error disabled:cursor-not-allowed disabled:opacity-50"
            >
              Desvincular
            </button>
          </div>
        </div>
      ) : null}

      {isFormOpen ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-lg border border-outline-variant bg-surface-container-low p-3"
        >
          <div>
            <label className="stitch-label" htmlFor={`badge-uid-${employeeId}`}>
              Número de tarjeta
            </label>
            <input
              id={`badge-uid-${employeeId}`}
              type="text"
              value={badgeUid}
              onChange={(event) => setBadgeUid(event.target.value)}
              placeholder="Escribe el ID exacto que entrega el lector"
              autoComplete="off"
              disabled={isSubmitting}
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 font-mono text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <p className="mt-1 text-[11px] text-on-surface-variant">
              No se modifican mayúsculas/minúsculas ni espacios internos: escríbelo exactamente como lo
              entrega el lector.
            </p>
          </div>

          <div>
            <label className="stitch-label" htmlFor={`badge-location-${employeeId}`}>
              Ubicación
            </label>
            <select
              id={`badge-location-${employeeId}`}
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              disabled={isSubmitting}
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Selecciona una ubicación</option>
              {activeLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            {locationHasNoActiveDevice ? (
              <p className="mt-1.5 rounded-md bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
                Esta ubicación no tiene ningún dispositivo móvil activo. La tarjeta no podrá usarse
                para iniciar sesión hasta que haya un dispositivo enrolado ahí (o se vincule esta
                tarjeta a uno específico).
              </p>
            ) : null}
          </div>

          <div>
            <label className="stitch-label" htmlFor={`badge-label-${employeeId}`}>
              Etiqueta (opcional)
            </label>
            <input
              id={`badge-label-${employeeId}`}
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ej. Tarjeta principal"
              maxLength={80}
              disabled={isSubmitting}
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {fieldError ? <p className="text-xs text-error">{fieldError}</p> : null}
          {submitError ? <p className="text-xs text-error">{submitError}</p> : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="stitch-btn-primary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              disabled={isSubmitting}
              className="stitch-btn-secondary px-3 py-1.5 text-xs"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {showRevokeConfirm ? (
        <div className="rounded-lg border border-outline-variant bg-surface-container-low p-3">
          <p className="text-xs text-on-surface">
            ¿Desvincular la tarjeta de {employeeName}? Dejará de poder iniciar sesión con ella de inmediato.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRevoke}
              disabled={isRevoking}
              className="stitch-btn-danger px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRevoking ? "Desvinculando…" : "Sí, desvincular"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRevokeConfirm(false);
                setRevokeError(null);
              }}
              disabled={isRevoking}
              className="stitch-btn-secondary px-3 py-1.5 text-xs"
            >
              Cancelar
            </button>
          </div>
          {revokeError ? <p className="mt-1.5 text-xs text-error">{revokeError}</p> : null}
        </div>
      ) : null}

      {successMessage ? <p className="text-center text-xs text-success">{successMessage}</p> : null}
    </div>
  );
}
