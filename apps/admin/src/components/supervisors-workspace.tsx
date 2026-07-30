"use client";

import Link from "next/link";
import { useMemo } from "react";

import { AddSupervisorCta } from "./add-supervisor-cta";
import { EmptyState } from "./empty-state";
import { EmployeesModuleIntro } from "./employees-module-intro";
import {
  SUPERVISORS_INTRO_COPY,
  SUPERVISORS_LOCATION_HELP_COPY
} from "../lib/employees-module-copy";
import {
  formatAssignedLocationCount,
  formatSupervisorLabel,
  groupAssignmentsBySupervisor,
  type CompanySupervisorRecord,
  type LocationOption,
  type SupervisorLocationAssignmentRecord
} from "../lib/supervisor-assignment-utils";

type SupervisorsWorkspaceProps = {
  readonly companyId: string;
  readonly companyName: string;
  readonly supervisors: CompanySupervisorRecord[];
  readonly assignments: SupervisorLocationAssignmentRecord[];
  readonly locations: LocationOption[];
};

function SupervisorStatusBadge({ status }: { readonly status: CompanySupervisorRecord["status"] }) {
  if (status === "INVITED") {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
        Pending invite
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
      Active
    </span>
  );
}

function SupervisorTable({
  supervisors,
  assignmentsBySupervisor,
  companyId
}: {
  readonly supervisors: CompanySupervisorRecord[];
  readonly assignmentsBySupervisor: Map<string, SupervisorLocationAssignmentRecord[]>;
  readonly companyId: string;
}) {
  if (supervisors.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/30">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                Supervisor
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                Email
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                Locations assigned
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                Status
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {supervisors.map((supervisor) => {
              const supervisorKey = supervisor.userId ?? supervisor.email;
              const supervisorAssignments = supervisor.userId
                ? (assignmentsBySupervisor.get(supervisor.userId) ?? [])
                : [];
              const locationNames = supervisorAssignments.map((assignment) => assignment.location.name);

              return (
                <tr key={supervisorKey} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3.5 font-medium text-slate-900">
                    {formatSupervisorLabel(supervisor)}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">{supervisor.email}</td>
                  <td className="px-4 py-3.5 text-slate-600">
                    {locationNames.length > 0 ? (
                      <span title={locationNames.join(", ")}>
                        {locationNames.slice(0, 2).join(", ")}
                        {locationNames.length > 2 ? ` +${locationNames.length - 2} more` : ""}
                      </span>
                    ) : (
                      <span className="text-slate-400">
                        {formatAssignedLocationCount(supervisor.assignedLocationCount)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <SupervisorStatusBadge status={supervisor.status} />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {supervisor.status === "ACTIVE" && supervisor.userId ? (
                      <Link
                        href={`/users?companyId=${encodeURIComponent(companyId)}#supervisor-access`}
                        className="text-sm font-medium text-brand-700 hover:text-brand-800"
                      >
                        Manage locations
                      </Link>
                    ) : (
                      <span className="text-sm text-slate-400">Awaiting acceptance</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SupervisorsWorkspace({
  companyId,
  companyName,
  supervisors,
  assignments,
  locations
}: SupervisorsWorkspaceProps) {
  const assignmentsBySupervisor = useMemo(
    () => groupAssignmentsBySupervisor(assignments),
    [assignments]
  );

  const pendingSupervisors = supervisors.filter((supervisor) => supervisor.status === "INVITED");
  const activeSupervisors = supervisors.filter((supervisor) => supervisor.status === "ACTIVE");
  const manageLocationsHref = `/users?companyId=${encodeURIComponent(companyId)}#supervisor-access`;

  if (supervisors.length === 0) {
    return (
      <div className="space-y-6">
        <EmployeesModuleIntro help={SUPERVISORS_LOCATION_HELP_COPY}>
          {SUPERVISORS_INTRO_COPY}
        </EmployeesModuleIntro>
        <EmptyState
          title="No supervisors yet"
          description={SUPERVISORS_INTRO_COPY}
          action={
            <AddSupervisorCta
              companyId={companyId}
              companyName={companyName}
              locations={locations}
            />
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <EmployeesModuleIntro help={SUPERVISORS_LOCATION_HELP_COPY}>
        {SUPERVISORS_INTRO_COPY}
      </EmployeesModuleIntro>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          {supervisors.length} {supervisors.length === 1 ? "supervisor" : "supervisors"} ·{" "}
          {activeSupervisors.length} active · {pendingSupervisors.length} pending
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={manageLocationsHref}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Manage locations
          </Link>
          <AddSupervisorCta companyId={companyId} companyName={companyName} locations={locations} />
        </div>
      </div>

      {pendingSupervisors.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Pending invitations</h2>
          <SupervisorTable
            supervisors={pendingSupervisors}
            assignmentsBySupervisor={assignmentsBySupervisor}
            companyId={companyId}
          />
        </section>
      ) : null}

      {activeSupervisors.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Active supervisors</h2>
          <SupervisorTable
            supervisors={activeSupervisors}
            assignmentsBySupervisor={assignmentsBySupervisor}
            companyId={companyId}
          />
        </section>
      ) : null}
    </div>
  );
}
