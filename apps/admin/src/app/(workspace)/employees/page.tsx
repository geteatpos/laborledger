import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { EmployeesKpiStrip } from "../../../components/employees-kpi-strip";
import { EmployeesSectionNav } from "../../../components/employees-section-nav";
import { EmployeesWorkspace } from "../../../components/employees-workspace";
import type { EmployeeProfile } from "../../../lib/employee-utils";
import { EMPLOYEES_MODULE_DESCRIPTION } from "../../../lib/employees-module-copy";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import type { CompanySupervisorRecord } from "../../../lib/supervisor-assignment-utils";
import {
  API_BASE_URL,
  apiGet,
  loadWorkspaceContext,
  WorkspaceApiError
} from "../../../lib/workspace-auth";

type EmployeesPageProps = {
  readonly searchParams?: Promise<{
    companyId?: string;
    status?: string;
    q?: string;
  }>;
};

function resolveStatusFilter(status?: string): "active" | "inactive" | "all" {
  if (status === "inactive" || status === "all") {
    return status;
  }

  return "active";
}

export default async function EmployeesPage({ searchParams }: EmployeesPageProps) {
  try {
    const query = (await searchParams) ?? {};
    const statusFilter = resolveStatusFilter(query.status);
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell title="Gestión de Empleados" description={EMPLOYEES_MODULE_DESCRIPTION}>
          <EmployeesSectionNav />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, selectedCompany, companies } = workspace;

    const [employees, supervisors] = await Promise.all([
      apiGet<EmployeeProfile[]>(
        `/company-operations/companies/${selectedCompany.id}/employees?includeArchived=true`,
        cookieHeader
      ),
      apiGet<CompanySupervisorRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/supervisors`,
        cookieHeader
      ).catch(() => [] as CompanySupervisorRecord[])
    ]);

    const visibleEmployees =
      statusFilter === "inactive"
        ? employees.filter((employee) => employee.archivedAt)
        : statusFilter === "active"
          ? employees.filter((employee) => !employee.archivedAt)
          : employees;

    const activeEmployeeCount = employees.filter((employee) => !employee.archivedAt).length;
    const inactiveEmployeeCount = employees.filter((employee) => employee.archivedAt).length;

    return (
      <AdminShell title="Gestión de Empleados" description={EMPLOYEES_MODULE_DESCRIPTION}>
        <EmployeesSectionNav />
        <EmployeesKpiStrip
          totalEmployees={employees.length}
          activeEmployees={activeEmployeeCount}
          supervisors={supervisors.length}
          inactiveEmployees={inactiveEmployeeCount}
        />
        <EmployeesWorkspace
          companies={companies}
          selectedCompany={selectedCompany}
          employees={visibleEmployees}
          initialQuery={query.q ?? ""}
          initialStatus={statusFilter}
        />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) {
      redirect("/login");
    }

    const apiUnreachable = error instanceof WorkspaceApiError && error.status === 0;

    return (
      <AdminShell title="Gestión de Empleados" description={EMPLOYEES_MODULE_DESCRIPTION}>
        <EmployeesSectionNav />
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {apiUnreachable ? (
            <>
              The API at <code className="font-mono">{API_BASE_URL}</code> is not reachable. Start it with{" "}
              <code className="font-mono">pnpm dev</code> from the repo root, or run{" "}
              <code className="font-mono">pnpm --filter @laborledger/api dev</code> in a separate terminal.
            </>
          ) : (
            <>Check that the API is running and that your session is valid.</>
          )}
        </p>
      </AdminShell>
    );
  }
}
