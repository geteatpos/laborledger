import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { TimeSectionNav } from "../../../components/time-section-nav";
import { AttendanceWorkspace } from "../../../components/attendance-workspace";
import type { EmployeeProfile } from "../../../lib/employee-utils";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import {
  API_BASE_URL,
  apiGet,
  loadWorkspaceContext,
  WorkspaceApiError
} from "../../../lib/workspace-auth";

type AttendancePageProps = {
  readonly searchParams?: Promise<{
    companyId?: string;
  }>;
};

export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  try {
    const _query = (await searchParams) ?? {};
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell title="Control de Asistencia" description="Registro de entrada y salida de empleados">
          <TimeSectionNav />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, selectedCompany } = workspace;

    const employees = await apiGet<EmployeeProfile[]>(
      `/company-operations/companies/${selectedCompany.id}/employees?includeArchived=false`,
      cookieHeader
    );

    return (
      <AdminShell
        title="Control de Asistencia"
        description="Registro de entrada y salida de empleados"
      >
        <TimeSectionNav />
        <AttendanceWorkspace
          selectedCompany={selectedCompany}
          employees={employees}
        />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) {
      redirect("/login");
    }

    const apiUnreachable = error instanceof WorkspaceApiError && error.status === 0;

    return (
      <AdminShell title="Control de Asistencia" description="Registro de entrada y salida de empleados">
        <TimeSectionNav />
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {apiUnreachable ? (
            <>
              The API at <code className="font-mono">{API_BASE_URL}</code> is not reachable. Start it with{" "}
              <code className="font-mono">pnpm dev</code> from the repo root.
            </>
          ) : (
            <>Check that the API is running and that your session is valid.</>
          )}
        </p>
      </AdminShell>
    );
  }
}
