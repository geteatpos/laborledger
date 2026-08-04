import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { EmployeesModuleIntro } from "../../../components/employees-module-intro";
import { EmployeesSectionNav } from "../../../components/employees-section-nav";
import { UsersWorkspace } from "../../../components/users-workspace";
import { SupervisorLocationAccessSection } from "../../../components/supervisor-location-access-section";
import {
  EMPLOYEES_MODULE_DESCRIPTION,
  ROLES_ACCESS_DESCRIPTION
} from "../../../lib/employees-module-copy";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import type {
  CompanySupervisorRecord,
  LocationOption,
  SupervisorLocationAssignmentRecord
} from "../../../lib/supervisor-assignment-utils";
import { SUPERVISOR_FORBIDDEN_MESSAGE, type CompanyAccessContext } from "../../../lib/supervisor-scope-utils";
import {
  type UserInvitationRecord
} from "../../../lib/user-invite-utils";
import type { CompanyMemberRecord } from "../../../lib/company-member-utils";
import { apiGet, loadWorkspaceContext, WorkspaceApiError } from "../../../lib/workspace-auth";

export default async function UsersPage() {
  try {
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell title="Roles y acceso" description={EMPLOYEES_MODULE_DESCRIPTION}>
          <EmployeesSectionNav />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, session, selectedCompany } = workspace;

    const accessContext = await apiGet<CompanyAccessContext>(
      `/company-operations/companies/${selectedCompany.id}/access-context`,
      cookieHeader
    );

    if (!accessContext.canManageCompany) {
      return (
        <AdminShell title="Roles y acceso" description={EMPLOYEES_MODULE_DESCRIPTION}>
          <EmployeesSectionNav />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {SUPERVISOR_FORBIDDEN_MESSAGE}
          </p>
        </AdminShell>
      );
    }

    const invitations = await apiGet<UserInvitationRecord[]>(
      `/auth/invitations?companyId=${encodeURIComponent(selectedCompany.id)}`,
      cookieHeader
    );

    const [supervisors, supervisorAssignments, locations, members] = await Promise.all([
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
      ),
      apiGet<CompanyMemberRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/members`,
        cookieHeader
      )
    ]);

    return (
      <AdminShell title="Roles y acceso" description={EMPLOYEES_MODULE_DESCRIPTION}>
        <EmployeesSectionNav />
        <EmployeesModuleIntro>{ROLES_ACCESS_DESCRIPTION}</EmployeesModuleIntro>
        <div className="space-y-8">
          <UsersWorkspace
            company={selectedCompany}
            invitations={invitations}
            members={members}
            signedInEmail={session.user.email}
            signedInUserId={session.user.id}
          />
          <SupervisorLocationAccessSection
            companyId={selectedCompany.id}
            supervisors={supervisors}
            assignments={supervisorAssignments}
            locations={locations}
          />
        </div>
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) {
      redirect("/login");
    }

    return (
      <AdminShell title="Roles y acceso" description={EMPLOYEES_MODULE_DESCRIPTION}>
        <EmployeesSectionNav />
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          No se pudo cargar la configuración de roles y acceso. Verifica que la API esté corriendo e intenta de nuevo.
        </p>
      </AdminShell>
    );
  }
}
