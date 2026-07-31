"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CreateEmployeeForm } from "./create-employee-form";
import { EditEmployeeForm } from "./edit-employee-form";
import { EmployeeDetailDrawer } from "./employee-detail-drawer";
import { EmployeeStatusBadge } from "./employee-status-badge";
import { EmptyState } from "./empty-state";
import { MaterialIcon } from "./ui/material-icon";
import type { CompanyRecord, EmployeeProfile } from "../lib/employee-utils";
import {
  EMPLOYEES_TEAM_EMPTY_DESCRIPTION,
  EMPLOYEES_TEAM_EMPTY_TITLE,
  EMPLOYEES_TEAM_INTRO
} from "../lib/employees-module-copy";
import {
  employeeInitials,
  employeePhotoSrc,
  filterEmployeesByQueryProfile,
  formatEmployeeCode,
  formatEmployeeDate
} from "../lib/employee-utils";

type EmployeesWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly employees: EmployeeProfile[];
  readonly initialQuery: string;
  readonly initialStatus: "active" | "inactive" | "all";
};

export function EmployeesWorkspace({
  companies,
  selectedCompany,
  employees,
  initialQuery,
  initialStatus
}: EmployeesWorkspaceProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const filteredEmployees = useMemo(() => filterEmployeesByQueryProfile(employees, query), [employees, query]);

  const selectedEmployee =
    filteredEmployees.find((employee) => employee.id === selectedEmployeeId) ??
    employees.find((employee) => employee.id === selectedEmployeeId) ??
    null;

  function buildEmployeesHref(overrides: { companyId?: string; status?: string; q?: string }) {
    const params = new URLSearchParams();
    params.set("companyId", overrides.companyId ?? selectedCompany.id);

    const status = overrides.status ?? initialStatus;
    if (status !== "active") {
      params.set("status", status);
    }

    const search = overrides.q ?? query;
    if (search.trim()) {
      params.set("q", search.trim());
    }

    return `/employees?${params.toString()}`;
  }

  return (
    <>
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-semibold leading-7 text-on-surface">Plantilla de Personal</h3>
          <p className="mt-1 text-body-sm text-secondary">{EMPLOYEES_TEAM_INTRO}</p>
        </div>
        <CreateEmployeeForm companyId={selectedCompany.id} />
      </div>

      {companies.length > 1 ? (
        <div className="mb-6 rounded-xl border border-outline-variant bg-white p-4 shadow-subtle">
          <p className="mb-2.5 text-label-sm uppercase tracking-wider text-secondary">Empresa</p>
          <div className="flex flex-wrap gap-2">
            {companies.map((company) => {
              const isSelected = company.id === selectedCompany.id;
              return (
                <Link
                  key={company.id}
                  href={buildEmployeesHref({ companyId: company.id })}
                  className={isSelected ? "stitch-chip-active" : "stitch-chip-inactive"}
                >
                  {company.name}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {filteredEmployees.length === 0 ? (
        employees.length === 0 ? (
          <EmptyState
            title={EMPLOYEES_TEAM_EMPTY_TITLE}
            description={EMPLOYEES_TEAM_EMPTY_DESCRIPTION}
            action={<CreateEmployeeForm companyId={selectedCompany.id} />}
          />
        ) : (
          <EmptyState
            title="Ningún empleado coincide con la búsqueda"
            description="Prueba otro nombre o limpia el filtro."
          />
        )
      ) : (
        <div className="flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-white shadow-subtle">
          <div className="flex flex-col items-center justify-between gap-4 border-b border-outline-variant bg-white p-4 sm:flex-row">
            <div className="flex w-full items-center gap-2 overflow-x-auto sm:w-auto">
              {(["all", "active", "inactive"] as const).map((status) => {
                const isSelected =
                  status === "all" ? initialStatus === "all" : initialStatus === status;
                const label =
                  status === "all" ? "Todos" : status === "active" ? "Activos" : "Inactivos";

                return (
                  <Link
                    key={status}
                    href={buildEmployeesHref({ status })}
                    className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-label-sm font-medium transition-colors ${
                      isSelected
                        ? "border-outline-variant bg-surface-container-low text-on-surface"
                        : "border-dashed border-outline-variant bg-white text-secondary hover:bg-surface-variant"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>

            <div className="relative w-full sm:w-64">
              <MaterialIcon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-secondary"
              />
              <input
                id="employee-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre o puesto..."
                className="stitch-input w-full pl-9 pr-3"
              />
            </div>
          </div>

          <div className="stitch-table-wrap hidden md:block">
            <table className="stitch-table w-full text-left">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="w-1/3 px-4 py-3 text-label-sm font-bold uppercase tracking-wider text-[#111827]">
                    Empleado
                  </th>
                  <th className="px-4 py-3 text-label-sm font-bold uppercase tracking-wider text-[#111827]">
                    Puesto
                  </th>
                  <th className="px-4 py-3 text-center text-label-sm font-bold uppercase tracking-wider text-[#111827]">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-label-sm font-bold uppercase tracking-wider text-[#111827]">
                    Alta
                  </th>
                  <th className="px-4 py-3 text-right text-label-sm font-bold uppercase tracking-wider text-[#111827]">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {filteredEmployees.map((employee) => {
                  const photoSrc = employeePhotoSrc(
                    selectedCompany.id,
                    employee.id,
                    employee.photoUrl
                  );

                  return (
                    <tr
                      key={employee.id}
                      className="transition-colors duration-150 hover:[&>td]:bg-[#f3f4f5]"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedEmployeeId(employee.id)}
                          className="flex w-full items-center gap-3 text-left"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-outline-variant bg-surface-variant text-[11px] font-medium text-on-surface-variant">
                            {photoSrc ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={photoSrc}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              employeeInitials(employee.fullName)
                            )}
                          </div>
                          <div>
                            <p className="text-body-sm font-medium text-on-surface">{employee.fullName}</p>
                            <p className="text-label-sm text-secondary">
                              {formatEmployeeCode(employee.id)}
                            </p>
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-body-sm text-on-surface">{employee.title?.trim() || "Sin puesto"}</p>
                        <p className="text-label-sm text-secondary">
                          {employee.department?.trim() || "Sin departamento"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <EmployeeStatusBadge archivedAt={employee.archivedAt} />
                      </td>
                      <td className="px-4 py-3 text-right text-body-sm text-on-surface-variant">
                        {formatEmployeeDate(employee.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedEmployeeId(employee.id)}
                            title="Ver perfil"
                            className="rounded-md p-1.5 text-secondary transition-colors hover:bg-surface-variant hover:text-primary"
                          >
                            <MaterialIcon name="visibility" className="text-[20px]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedEmployeeId(employee.id)}
                            title="Editar"
                            className="rounded-md p-1.5 text-secondary transition-colors hover:bg-surface-variant hover:text-primary"
                          >
                            <MaterialIcon name="edit" className="text-[20px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-4 md:hidden">
            {filteredEmployees.map((employee) => {
              const photoSrc = employeePhotoSrc(
                selectedCompany.id,
                employee.id,
                employee.photoUrl
              );

              return (
                <article
                  key={employee.id}
                  className="rounded-xl border border-outline-variant bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedEmployeeId(employee.id)}
                      className="flex items-center gap-3 text-left"
                    >
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-outline-variant bg-surface-variant text-xs font-medium text-on-surface-variant">
                        {photoSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photoSrc} alt="" className="h-full w-full object-cover" />
                        ) : (
                          employeeInitials(employee.fullName)
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-on-surface">{employee.fullName}</p>
                        <p className="text-label-sm text-secondary">
                          {employee.title?.trim() || "Sin puesto"}
                        </p>
                      </div>
                    </button>
                    <EmployeeStatusBadge archivedAt={employee.archivedAt} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedEmployeeId(employee.id)}
                      className="stitch-btn-secondary px-3 py-1.5 text-xs"
                    >
                      Ver perfil
                    </button>
                    <EditEmployeeForm employeeId={employee.id} initialFullName={employee.fullName} />
                  </div>
                </article>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-outline-variant bg-white p-4">
            <span className="text-label-sm text-secondary">
              Mostrando {filteredEmployees.length} de {employees.length} empleados
              {initialStatus !== "all" ? ` · filtro ${initialStatus === "active" ? "activos" : "inactivos"}` : ""}
            </span>
          </div>
        </div>
      )}

      <EmployeeDetailDrawer
        employee={selectedEmployee}
        companyId={selectedCompany.id}
        companyName={selectedCompany.name}
        onClose={() => setSelectedEmployeeId(null)}
      />
    </>
  );
}
