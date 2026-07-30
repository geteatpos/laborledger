import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { TimeSectionNav } from "../../../components/time-section-nav";
import { MobileDevicesWorkspace } from "../../../components/mobile-devices-workspace";
import type { MobileDeviceRecord } from "../../../components/mobile-devices-workspace";
import {
  API_BASE_URL,
  apiGet,
  loadWorkspaceContext,
  WorkspaceApiError
} from "../../../lib/workspace-auth";
import type { CompanyAccessContext } from "../../../lib/supervisor-scope-utils";
import { SUPERVISOR_FORBIDDEN_MESSAGE, supervisorScopeEmptyMessage } from "../../../lib/supervisor-scope-utils";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";

type MobileDevicesPageProps = {
  readonly searchParams?: Promise<{
    companyId?: string;
    locationId?: string;
  }>;
};

export default async function MobileDevicesPage({ searchParams }: MobileDevicesPageProps) {
  try {
    const query = (await searchParams) ?? {};
    const locationFilter = query.locationId?.trim() ?? "";
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell title="Mobile Devices" description="Manage mobile device enrollment">
          <TimeSectionNav />
          <p className="stitch-alert-warning">
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

    if (!accessContext.canAccessKioskAdmin) {
      return (
        <AdminShell title="Mobile Devices" description="Manage mobile device enrollment">
          <TimeSectionNav />
          <p className="stitch-card text-sm text-on-surface-variant">
            {SUPERVISOR_FORBIDDEN_MESSAGE}
          </p>
        </AdminShell>
      );
    }

    const emptyScopeMessage = supervisorScopeEmptyMessage(accessContext);
    if (emptyScopeMessage) {
      return (
        <AdminShell title="Mobile Devices" description="Manage mobile device enrollment">
          <TimeSectionNav />
          <p className="stitch-card text-sm text-on-surface-variant">
            {emptyScopeMessage}
          </p>
        </AdminShell>
      );
    }

    const locationQuery = locationFilter ? `&locationId=${encodeURIComponent(locationFilter)}` : "";

    const [devices, locations] = await Promise.all([
      apiGet<MobileDeviceRecord[]>(
        `/mobile/devices?companyId=${selectedCompany.id}${locationQuery}`,
        cookieHeader
      ),
      apiGet<{ id: string; name: string }[]>(
        `/company-operations/companies/${selectedCompany.id}/locations?includeArchived=true`,
        cookieHeader
      )
    ]);

    const activeDevices = devices.filter((device) => device.status === "ACTIVE");

    return (
      <AdminShell
        title="Mobile Devices"
        description="Manage mobile device enrollment"
        actions={
          <span className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-1.5 text-sm font-medium text-on-surface">
            {activeDevices.length} {activeDevices.length === 1 ? "device" : "devices"}
          </span>
        }
      >
        <TimeSectionNav />
        <MobileDevicesWorkspace
          devices={activeDevices}
          companyId={selectedCompany.id}
          locations={locations}
        />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) {
      redirect("/login");
    }

    const apiUnreachable = error instanceof WorkspaceApiError && error.status === 0;

    return (
      <AdminShell title="Mobile Devices" description="Manage mobile device enrollment">
        <TimeSectionNav />
        <p className="stitch-alert-error">
          {apiUnreachable ? (
            <>
              The API at <code className="font-mono">{API_BASE_URL}</code> is not reachable. Start
              it with <code className="font-mono">pnpm dev</code> from the repo root.
            </>
          ) : (
            <>Check that the API is running and that your session is valid.</>
          )}
        </p>
      </AdminShell>
    );
  }
}
