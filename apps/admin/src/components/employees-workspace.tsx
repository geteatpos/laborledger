"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CreateEmployeeForm } from "./create-employee-form";
import { EditEmployeeForm } from "./edit-employee-form";
import { EmployeeAccessBadge } from "./employee-access-badge";
import { EmployeeDetailDrawer } from "./employee-detail-drawer";
import { EmployeeStatusBadge } from "./employee-status-badge";
import { EmptyState } from "./empty-state";
import type { CompanyRecord, EmployeeRecord } from "../lib/employee-utils";
import {
  EMPLOYEES_TEAM_EMPTY_DESCRIPTION,
  EMPLOYEES_TEAM_EMPTY_TITLE
} from "../lib/employees-module-copy";
import {
  employeeInitials,
  filterEmployeesByQuery,
  formatEmployeeDate
} from "../lib/employee-utils";

type EmployeesWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly employees: EmployeeRecord[];
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

  const filteredEmployees = useMemo(() => filterEmployeesByQuery(employees, query), [employees, query]);

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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="stitch-section-title text-body-sm">Equipo</h2>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            {filteredEmployees.length} {filteredEmployees.length === 1 ? "empleado" : "empleados"}
            {initialStatus !== "active" ? ` · filtro ${initialStatus}` : ""}
          </p>
        </div>
        <CreateEmployeeForm companyId={selectedCompany.id} />
      </div>

      {companies.length > 1 ? (
        <div className="mb-6 stitch-filter-panel">
          <p className="stitch-label mb-2.5">Empresa</p>
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

      <div className="mb-4 stitch-filter-panel sm:flex-row sm:items-end sm:justify-between flex flex-col gap-3">
        <div className="flex-1">
          <label className="stitch-label mb-2 block" htmlFor="employee-search">
            Buscar
          </label>
          <input
            id="employee-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre…"
            className="stitch-input max-w-md"
          />
        </div>

        <div>
          <p className="stitch-label mb-2">Estado</p>
          <div className="flex flex-wrap gap-2">
            {(["active", "inactive", "all"] as const).map((status) => {
              const isSelected = initialStatus === status;
              const label = status === "active" ? "Activos" : status === "inactive" ? "Inactivos" : "Todos";
              return (
                <Link
                  key={status}
                  href={buildEmployeesHref({ status })}
                  className={isSelected ? "stitch-chip-active" : "stitch-chip-inactive"}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

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
        <>
          <div className="stitch-table-wrap hidden md:block">
            <div className="overflow-x-auto">
              <table className="stitch-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Acceso</th>
                    <th>Tarifa</th>
                    <th>Estado</th>
                    <th>Alta</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => setSelectedEmployeeId(employee.id)}
                          className="flex w-full items-center gap-3 text-left"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline-variant-30 bg-surface-container-low text-[11px] font-medium text-on-surface-variant">
                            {employeeInitials(employee.fullName)}
                          </div>
                          <span className="font-medium text-on-surface hover:text-primary">{employee.fullName}</span>
                        </button>
                      </td>
                      <td>
                        <EmployeeAccessBadge />
                        <p className="mt-1 text-xs text-on-surface-variant">Field PIN</p>
                      </td>
                      <td className="text-on-surface-variant">
                        <button
                          type="button"
                          onClick={() => setSelectedEmployeeId(employee.id)}
                          className="text-sm text-primary hover:brightness-110"
                        >
                          View pay rate
                        </button>
                      </td>
                      <td>
                        <EmployeeStatusBadge archivedAt={employee.archivedAt} />
                      </td>
                      <td className="text-on-surface-variant">{formatEmployeeDate(employee.createdAt)}</td>
                      <td className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedEmployeeId(employee.id)}
                            className="stitch-btn-secondary px-3 py-1.5 text-xs"
                          >
                            Ver
                          </button>
                          <EditEmployeeForm employeeId={employee.id} initialFullName={employee.fullName} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {filteredEmployees.map((employee) => (
              <article
                key={employee.id}
                className="stitch-card rounded-stitch p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant-30 bg-surface-container-low text-xs font-medium text-on-surface-variant">
                      {employeeInitials(employee.fullName)}
                    </div>
                    <div>
                      <p className="font-medium text-on-surface">{employee.fullName}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <EmployeeAccessBadge />
                        <p className="text-xs text-on-surface-variant">{formatEmployeeDate(employee.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                  <EmployeeStatusBadge archivedAt={employee.archivedAt} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedEmployeeId(employee.id)}
                    className="stitch-btn-secondary px-3 py-1.5 text-xs"
                  >
                    View details
                  </button>
                  <EditEmployeeForm employeeId={employee.id} initialFullName={employee.fullName} />
                </div>
              </article>
            ))}
          </div>
        </>
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
