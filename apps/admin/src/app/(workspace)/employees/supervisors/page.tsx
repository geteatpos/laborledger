import { redirect } from "next/navigation";

import { AdminShell } from "../../../../components/admin-shell";
import { EmployeesSectionNav } from "../../../../components/employees-section-nav";
import { SupervisorsWorkspace } from "../../../../components/supervisors-workspace";
import { EMPLOYEES_MODULE_DESCRIPTION } from "../../../../lib/employees-module-copy";
import { formatChooseCompanyBlockedCopy } from "../../../../lib/auth-utils";
import type {
  CompanySupervisorRecord,
  LocationOption,
  SupervisorLocationAssignmentRecord
} from "../../../../lib/supervisor-assignment-utils";
import { SUPERVISOR_FORBIDDEN_MESSAGE, type CompanyAccessContext } from "../../../../lib/supervisor-scope-utils";
import { apiGet, loadWorkspaceContext, WorkspaceApiError } from "../../../../lib/workspace-auth";

export default async function SupervisorsPage() {
  try {
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell title="Supervisors" description={EMPLOYEES_MODULE_DESCRIPTION}>
          <EmployeesSectionNav />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, selectedCompany } = workspace;

    const accessContext = await apiGet<CompanyAccessContext>(
      `/company-operations/companies/${selectedCompany.id}/access-context`,
      cookieHeader
    );

    if (!accessContext.canManageCompany) {
      return (
        <AdminShell title="Supervisors" description={EMPLOYEES_MODULE_DESCRIPTION}>
          <EmployeesSectionNav />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {SUPERVISOR_FORBIDDEN_MESSAGE}
          </p>
        </AdminShell>
      );
    }

    const [supervisors, supervisorAssignments, locations] = await Promise.all([
      apiGet<CompanySupervisorRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/supervisors`,
        cookieHeader
      ),
      apiGet<SupervisorLocationAssignmentRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/supervisor-location-assignments`,
        cookieHeader
      ),
      apiGet<LocationOption[]>(
        `/company-operations/companies/${selectedCompany.id}/locations?includeArchived=false`,
        cookieHeader
      )
    ]);

    return (
      <AdminShell title="Supervisors" description={EMPLOYEES_MODULE_DESCRIPTION}>
        <EmployeesSectionNav />
        <SupervisorsWorkspace
          companyId={selectedCompany.id}
          companyName={selectedCompany.name}
          supervisors={supervisors}
          assignments={supervisorAssignments}
          locations={locations}
        />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) {
      redirect("/login");
    }

    return (
      <AdminShell title="Supervisors" description={EMPLOYEES_MODULE_DESCRIPTION}>
        <EmployeesSectionNav />
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Unable to load supervisors. Check that the API is running and try again.
        </p>
      </AdminShell>
    );
  }
}
