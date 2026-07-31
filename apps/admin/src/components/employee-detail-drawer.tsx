"use client";

import { useEffect, useState } from "react";

import { ArchiveEmployeeButton } from "./archive-employee-button";
import { EditEmployeeForm } from "./edit-employee-form";
import { EmployeePhotoUpload } from "./employee-photo-upload";
import { EmployeeProfileForm } from "./employee-profile-form";
import { EmployeeStatusBadge } from "./employee-status-badge";
import { MaterialIcon } from "./ui/material-icon";
import { RegeneratePinForm } from "./regenerate-pin-form";
import { SetEmployeeRateForm } from "./set-employee-rate-form";
import type { EmployeeRateRecord, EmployeeProfile } from "../lib/employee-utils";
import {
  DEFAULT_HOURLY_RATE_USD,
  formatEmployeeDate,
  formatHourlyRate,
  resolveCurrentEmployeeRate
} from "../lib/employee-utils";

type EmployeeDetailDrawerProps = {
  readonly employee: EmployeeProfile | null;
  readonly companyId: string;
  readonly companyName: string;
  readonly onClose: () => void;
};

export function EmployeeDetailDrawer({ employee, companyId, companyName, onClose }: EmployeeDetailDrawerProps) {
  const [rates, setRates] = useState<EmployeeRateRecord[]>([]);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [ratesReloadKey, setRatesReloadKey] = useState(0);
  const [profileReloadKey, setProfileReloadKey] = useState(0);
  // photo reload key for refresh
  const [, setPhotoReloadKey] = useState(0);

  useEffect(() => {
    if (!employee) {
      setRates([]);
      setRatesError(null);
      return;
    }

    let cancelled = false;
    const employeeId = employee.id;

    async function loadRates() {
      setIsLoadingRates(true);
      setRatesError(null);

      const response = await fetch(`/api/company-operations/employees/${employeeId}/rates`);
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        rates?: EmployeeRateRecord[];
      };

      if (cancelled) {
        return;
      }

      setIsLoadingRates(false);

      if (!response.ok) {
        setRatesError(payload.message ?? "No se pudieron cargar las tarifas.");
        setRates([]);
        return;
      }

      setRates(Array.isArray(payload.rates) ? payload.rates : []);
    }

    void loadRates();

    return () => {
      cancelled = true;
    };
  }, [employee, ratesReloadKey]);

  if (!employee) {
    return null;
  }

  const currentRate = resolveCurrentEmployeeRate(rates);
  const isArchived = Boolean(employee.archivedAt);

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar perfil de empleado"
        className="fixed inset-0 z-40 bg-on-surface/25 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-outline-variant bg-surface-container-lowest shadow-xl"
        role="dialog"
        aria-labelledby="employee-detail-title"
      >
        <div className="flex items-start justify-between border-b border-outline-variant px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <EmployeePhotoUpload
              employeeId={employee.id}
              companyId={companyId}
              fullName={employee.fullName}
              currentPhotoUrl={employee.photoUrl ?? null}
              disabled={isArchived}
              onPhotoChange={() => setPhotoReloadKey((k) => k + 1)}
            />
            <div className="min-w-0">
              <p className="stitch-label">Perfil de empleado</p>
              <h2 id="employee-detail-title" className="truncate text-base font-semibold text-on-surface">
                {employee.fullName}
              </h2>
              <p className="text-xs text-on-surface-variant">{companyName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="stitch-btn-secondary px-2.5 py-1 text-xs">
            Cerrar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <EmployeeStatusBadge archivedAt={employee.archivedAt} />
            <span className="inline-flex items-center gap-1 text-xs text-on-surface-variant">
              <MaterialIcon name="calendar_today" className="text-[14px]" />
              Alta {formatEmployeeDate(employee.createdAt)}
            </span>
          </div>

          <section className="mt-6 space-y-3">
            <h3 className="stitch-label inline-flex items-center gap-1.5">
              <MaterialIcon name="person" className="text-[16px]" />
              Información personal
            </h3>
            <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
              <p className="stitch-label">Nombre completo</p>
              <p className="mt-1 text-sm font-medium text-on-surface">{employee.fullName}</p>
              <div className="mt-3">
                <EditEmployeeForm employeeId={employee.id} initialFullName={employee.fullName} />
              </div>
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="stitch-label inline-flex items-center gap-1.5">
              <MaterialIcon name="badge" className="text-[16px]" />
              Perfil
            </h3>
            <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
              <EmployeeProfileForm
                key={`profile-${employee.id}-${profileReloadKey}`}
                employeeId={employee.id}
                companyId={companyId}
                initialData={null}
                disabled={isArchived}
                onProfileChange={() => setProfileReloadKey((k) => k + 1)}
              />
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="stitch-label inline-flex items-center gap-1.5">
              <MaterialIcon name="apartment" className="text-[16px]" />
              Empresa
            </h3>
            <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface">
              <p className="font-medium">{companyName}</p>
              <p className="mt-2 text-xs text-on-surface-variant">
                Las sedes elegibles se gestionan en programación. Este empleado pertenece a una sola empresa.
              </p>
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="stitch-label inline-flex items-center gap-1.5">
              <MaterialIcon name="pin" className="text-[16px]" />
              PIN de Field
            </h3>
            <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
              <p className="text-sm text-on-surface-variant">
                Los PIN se almacenan hasheados y nunca se muestran después de guardarlos.
              </p>
              <div className="mt-3">
                <RegeneratePinForm
                  employeeId={employee.id}
                  employeeName={employee.fullName}
                  disabled={isArchived}
                />
              </div>
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="stitch-label inline-flex items-center gap-1.5">
              <MaterialIcon name="payments" className="text-[16px]" />
              Tarifa salarial
            </h3>
            <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
              {isLoadingRates ? (
                <p className="text-sm text-on-surface-variant">Cargando tarifas…</p>
              ) : ratesError ? (
                <p className="text-sm text-error">{ratesError}</p>
              ) : (
                <>
                  <p className="text-lg font-semibold text-on-surface">
                    {currentRate
                      ? `${formatHourlyRate(currentRate.rateMinorUnits, currentRate.currencyCode)}/h`
                      : `${formatHourlyRate(DEFAULT_HOURLY_RATE_USD * 100)}/h`}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Por defecto USD {DEFAULT_HOURLY_RATE_USD}/hora. Los cambios con fecha efectiva aparecen en el
                    historial.
                  </p>
                  {rates.length > 1 ? (
                    <ul className="mt-3 space-y-1 border-t border-outline-variant pt-3 text-xs text-on-surface-variant">
                      {rates.map((rate) => (
                        <li key={rate.id}>
                          {formatHourlyRate(rate.rateMinorUnits, rate.currencyCode)}/h · desde{" "}
                          {formatEmployeeDate(rate.effectiveStart)}
                          {rate.effectiveEnd
                            ? ` hasta ${formatEmployeeDate(rate.effectiveEnd)}`
                            : " · sin fin"}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <SetEmployeeRateForm
                    employeeId={employee.id}
                    disabled={isArchived}
                    onRateSet={() => setRatesReloadKey((key) => key + 1)}
                  />
                </>
              )}
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="stitch-label inline-flex items-center gap-1.5">
              <MaterialIcon name="toggle_on" className="text-[16px]" />
              Estado
            </h3>
            <ArchiveEmployeeButton
              employeeId={employee.id}
              fullName={employee.fullName}
              isArchived={isArchived}
            />
          </section>
        </div>
      </aside>
    </>
  );
}
