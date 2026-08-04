"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  buildAssignSupervisorLocationPath,
  buildBulkRemoveConfirmMessage,
  buildBulkRemoveSupervisorLocationsPath,
  buildRemoveSupervisorLocationPath,
  formatAssignedLocationCount,
  formatSupervisorLabel,
  groupAssignmentsBySupervisor,
  SUPERVISOR_ACCESS_HELPER_COPY,
  SUPERVISOR_PIN_HELPER_COPY,
  SUPERVISOR_ROLE_HELPER_COPY,
  supervisorAccessEmptyMessage,
  validateSupervisorAssignmentInput,
  type CompanySupervisorRecord,
  type LocationOption,
  type SupervisorLocationAssignmentRecord
} from "../lib/supervisor-assignment-utils";

type SupervisorLocationAccessSectionProps = {
  readonly companyId: string;
  readonly supervisors: CompanySupervisorRecord[];
  readonly assignments: SupervisorLocationAssignmentRecord[];
  readonly locations: LocationOption[];
};

export function SupervisorLocationAccessSection({
  companyId,
  supervisors,
  assignments,
  locations
}: SupervisorLocationAccessSectionProps) {
  const router = useRouter();
  const [selectedSupervisorId, setSelectedSupervisorId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeLocations = useMemo(
    () => locations.filter((location) => !location.archivedAt),
    [locations]
  );

  const activeSupervisors = useMemo(
    () => supervisors.filter((supervisor) => supervisor.status === "ACTIVE" && supervisor.userId),
    [supervisors]
  );

  const assignmentsBySupervisor = useMemo(
    () => groupAssignmentsBySupervisor(assignments),
    [assignments]
  );

  const emptyState = supervisorAccessEmptyMessage(activeSupervisors, activeLocations);

  async function handleAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const validationError = validateSupervisorAssignmentInput(selectedSupervisorId, selectedLocationId);
    if (validationError) {
      setFieldError(validationError);
      return;
    }

    setFieldError(null);
    setIsSubmitting(true);

    const response = await fetch(buildAssignSupervisorLocationPath(companyId, selectedSupervisorId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locationId: selectedLocationId })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "No se pudo asignar la ubicación.");
      return;
    }

    setSuccessMessage("Acceso por ubicación del supervisor actualizado.");
    setSelectedLocationId("");
    router.refresh();
  }

  return (
    <section id="supervisor-access" className="scroll-mt-24 space-y-5">
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/20">
        <h2 className="text-sm font-semibold text-slate-900">Acceso por ubicación de supervisores</h2>
        <p className="mt-1 text-sm text-slate-500">{SUPERVISOR_ACCESS_HELPER_COPY}</p>
        <p className="mt-2 text-sm text-slate-500">{SUPERVISOR_PIN_HELPER_COPY}</p>
        <p className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          {SUPERVISOR_ROLE_HELPER_COPY}
        </p>
      </div>

      <form
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30"
        onSubmit={handleAssign}
      >
        <h3 className="text-sm font-semibold text-slate-900">Asignar ubicación</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="supervisor-user">
              Supervisor
            </label>
            <select
              id="supervisor-user"
              value={selectedSupervisorId}
              onChange={(event) => setSelectedSupervisorId(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900"
              disabled={isSubmitting || activeSupervisors.length === 0}
            >
              <option value="">Selecciona un supervisor</option>
              {activeSupervisors.map((supervisor) => (
                <option key={supervisor.userId!} value={supervisor.userId!}>
                  {formatSupervisorLabel(supervisor)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="supervisor-location">
              Ubicación
            </label>
            <select
              id="supervisor-location"
              value={selectedLocationId}
              onChange={(event) => setSelectedLocationId(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900"
              disabled={isSubmitting || activeLocations.length === 0}
            >
              <option value="">Selecciona una ubicación</option>
              {activeLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSubmitting || activeSupervisors.length === 0 || activeLocations.length === 0}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Asignando…" : "Asignar ubicación"}
            </button>
          </div>
        </div>

        {fieldError ? <p className="mt-3 text-sm text-red-600">{fieldError}</p> : null}
      </form>

      {successMessage ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </p>
      ) : null}

      {submitError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</p>
      ) : null}

      {activeSupervisors.length === 0 || assignments.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <span className="font-medium text-slate-900">{emptyState.title}</span>
          <span className="mt-1 block">{emptyState.description}</span>
        </p>
      ) : (
        <div className="space-y-4">
          {activeSupervisors.map((supervisor) => (
            <SupervisorAssignmentCard
              key={supervisor.userId!}
              companyId={companyId}
              supervisor={supervisor}
              assignments={assignmentsBySupervisor.get(supervisor.userId!) ?? []}
              onError={setSubmitError}
              onSuccess={setSuccessMessage}
              onMutated={() => router.refresh()}
            />
          ))}
        </div>
      )}
    </section>
  );
}

type SupervisorAssignmentCardProps = {
  readonly companyId: string;
  readonly supervisor: CompanySupervisorRecord;
  readonly assignments: SupervisorLocationAssignmentRecord[];
  readonly onError: (message: string | null) => void;
  readonly onSuccess: (message: string | null) => void;
  readonly onMutated: () => void;
};

function SupervisorAssignmentCard({
  companyId,
  supervisor,
  assignments,
  onError,
  onSuccess,
  onMutated
}: SupervisorAssignmentCardProps) {
  const [selectedLocationIds, setSelectedLocationIds] = useState<Set<string>>(new Set());
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [isBulkRemoving, setIsBulkRemoving] = useState(false);

  const supervisorUserId = supervisor.userId!;
  const allSelected = assignments.length > 0 && selectedLocationIds.size === assignments.length;

  function toggleLocation(locationId: string) {
    setSelectedLocationIds((current) => {
      const next = new Set(current);
      if (next.has(locationId)) {
        next.delete(locationId);
      } else {
        next.add(locationId);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedLocationIds((current) =>
      current.size === assignments.length ? new Set() : new Set(assignments.map((a) => a.locationId))
    );
  }

  async function handleRemoveSingle(locationId: string) {
    const key = `${supervisorUserId}:${locationId}`;
    onError(null);
    onSuccess(null);
    setRemovingKey(key);

    const response = await fetch(buildRemoveSupervisorLocationPath(companyId, supervisorUserId, locationId), {
      method: "DELETE"
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setRemovingKey(null);

    if (!response.ok) {
      onError(payload.message ?? "No se pudo quitar la asignación.");
      return;
    }

    setSelectedLocationIds((current) => {
      const next = new Set(current);
      next.delete(locationId);
      return next;
    });
    onSuccess("Acceso por ubicación del supervisor eliminado.");
    onMutated();
  }

  async function handleBulkRemove(locationIds: string[]) {
    if (locationIds.length === 0) {
      return;
    }

    if (!window.confirm(buildBulkRemoveConfirmMessage(supervisor, locationIds.length))) {
      return;
    }

    onError(null);
    onSuccess(null);
    setIsBulkRemoving(true);

    const response = await fetch(buildBulkRemoveSupervisorLocationsPath(companyId, supervisorUserId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locationIds })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsBulkRemoving(false);

    if (!response.ok) {
      onError(payload.message ?? "No se pudieron quitar las ubicaciones seleccionadas.");
      return;
    }

    setSelectedLocationIds(new Set());
    onSuccess(
      locationIds.length === 1
        ? "1 ubicación quitada."
        : `${locationIds.length} ubicaciones quitadas.`
    );
    onMutated();
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/30">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{formatSupervisorLabel(supervisor)}</h3>
          <p className="text-sm text-slate-500">{supervisor.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-700">
            {formatAssignedLocationCount(supervisor.assignedLocationCount)}
          </span>
          {assignments.length > 0 ? (
            <button
              type="button"
              onClick={() => void handleBulkRemove(assignments.map((a) => a.locationId))}
              disabled={isBulkRemoving}
              className="text-sm font-medium text-red-600 hover:text-red-700 disabled:text-slate-400"
            >
              {isBulkRemoving ? "Quitando…" : "Quitar todas las ubicaciones"}
            </button>
          ) : null}
        </div>
      </div>

      {assignments.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Todavía no hay ubicaciones asignadas.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Seleccionar todas
            </label>

            {selectedLocationIds.size > 0 ? (
              <button
                type="button"
                onClick={() => void handleBulkRemove([...selectedLocationIds])}
                disabled={isBulkRemoving}
                className="text-sm font-medium text-red-600 hover:text-red-700 disabled:text-slate-400"
              >
                {isBulkRemoving ? "Quitando…" : `Quitar seleccionadas (${selectedLocationIds.size})`}
              </button>
            ) : null}
          </div>

          <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200">
            {assignments.map((assignment) => {
              const removeKey = `${assignment.supervisorUserId}:${assignment.locationId}`;

              return (
                <li
                  key={assignment.id}
                  className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedLocationIds.has(assignment.locationId)}
                      onChange={() => toggleLocation(assignment.locationId)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span>
                      <p className="text-sm font-medium text-slate-900">{assignment.location.name}</p>
                      <p className="text-xs text-slate-500">{assignment.location.timezone}</p>
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleRemoveSingle(assignment.locationId)}
                    disabled={removingKey === removeKey || isBulkRemoving}
                    className="text-sm font-medium text-red-600 hover:text-red-700 disabled:text-slate-400"
                  >
                    {removingKey === removeKey ? "Quitando…" : "Quitar"}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </article>
  );
}
