"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  ACTIVE_MEMBERS_HELPER_COPY,
  buildRevokeConfirmMessage,
  buildRoleChangeConfirmMessage,
  countActiveAdmins,
  formatMemberLabel,
  formatMemberRole,
  revokeCompanyMemberPath,
  updateCompanyMemberRolePath,
  type CompanyMemberRecord,
  type CompanyMemberRole
} from "../lib/company-member-utils";

type ActiveMembersSectionProps = {
  readonly companyId: string;
  readonly members: CompanyMemberRecord[];
  readonly signedInUserId?: string | undefined;
};

export function ActiveMembersSection({ companyId, members, signedInUserId }: ActiveMembersSectionProps) {
  const router = useRouter();
  const [changingId, setChangingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeAdminCount = countActiveAdmins(members);

  async function handleChangeRole(member: CompanyMemberRecord, newRole: CompanyMemberRole) {
    if (!window.confirm(buildRoleChangeConfirmMessage(member, newRole))) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setChangingId(member.membershipId);

    const response = await fetch(updateCompanyMemberRolePath(companyId, member.membershipId), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: newRole })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setChangingId(null);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "No se pudo cambiar el rol.");
      return;
    }

    setSuccessMessage(`Rol de ${formatMemberLabel(member)} actualizado a ${formatMemberRole(newRole)}.`);
    router.refresh();
  }

  async function handleRevoke(member: CompanyMemberRecord) {
    if (!window.confirm(buildRevokeConfirmMessage(member))) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setRevokingId(member.membershipId);

    const response = await fetch(revokeCompanyMemberPath(companyId, member.membershipId), {
      method: "POST"
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setRevokingId(null);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "No se pudo revocar el acceso.");
      return;
    }

    setSuccessMessage(`Acceso de ${formatMemberLabel(member)} revocado.`);
    router.refresh();
  }

  return (
    <section id="active-members" className="scroll-mt-24 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Miembros activos</h2>
        <p className="mt-1 text-sm text-slate-500">{ACTIVE_MEMBERS_HELPER_COPY}</p>
      </div>

      {successMessage ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>
      ) : null}

      {members.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          No hay miembros activos todavía.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/30">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                  Persona
                </th>
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                  Rol
                </th>
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                  Ubicaciones
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {members.map((member) => {
                const isSelf = Boolean(member.userId) && member.userId === signedInUserId;
                const isLastAdmin = member.role === "COMPANY_ADMIN" && activeAdminCount <= 1;
                const otherRole: CompanyMemberRole =
                  member.role === "COMPANY_ADMIN" ? "SUPERVISOR" : "COMPANY_ADMIN";
                const isChanging = changingId === member.membershipId;
                const isRevoking = revokingId === member.membershipId;

                return (
                  <tr key={member.membershipId} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-slate-900">{formatMemberLabel(member)}</p>
                      <p className="text-xs text-slate-500">{member.email}</p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">{formatMemberRole(member.role)}</td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {member.role === "SUPERVISOR" ? (member.assignedLocationCount ?? 0) : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        {isLastAdmin ? (
                          <span className="text-xs text-slate-400" title="No puedes cambiar el rol del único administrador activo.">
                            Único administrador activo
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleChangeRole(member, otherRole)}
                            disabled={isChanging || isRevoking}
                            className="text-sm font-medium text-brand-700 hover:text-brand-800 disabled:text-slate-400"
                          >
                            {isChanging ? "Cambiando…" : `Hacer ${otherRole === "COMPANY_ADMIN" ? "administrador" : "supervisor"}`}
                          </button>
                        )}

                        {isSelf ? (
                          <span className="text-xs text-slate-400" title="No puedes revocar tu propio acceso.">
                            Tu cuenta
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleRevoke(member)}
                            disabled={isRevoking || isChanging}
                            className="text-sm font-medium text-red-600 hover:text-red-700 disabled:text-slate-400"
                          >
                            {isRevoking ? "Revocando…" : "Revocar acceso"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
