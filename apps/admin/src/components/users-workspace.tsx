"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import type { AccessibleCompanyRecord } from "../lib/auth-utils";
import { ActiveMembersSection } from "./active-members-section";
import type { CompanyMemberRecord } from "../lib/company-member-utils";
import {
  formatInvitedByLabel,
  formatInvitationRole,
  formatInvitationStatus,
  invitationStatusClassName,
  INVITABLE_ROLES,
  USERS_PIN_HELPER_COPY,
  USERS_ACCESS_TYPES,
  validateInviteEmail,
  type InvitableRole,
  type UserInvitationRecord
} from "../lib/user-invite-utils";

type UsersWorkspaceProps = {
  readonly company: AccessibleCompanyRecord;
  readonly invitations: UserInvitationRecord[];
  readonly members: CompanyMemberRecord[];
  readonly signedInEmail?: string;
  readonly signedInUserId?: string;
};

export function UsersWorkspace({
  company,
  invitations,
  members,
  signedInEmail,
  signedInUserId
}: UsersWorkspaceProps) {
  const router = useRouter();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableRole>("COMPANY_ADMIN");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const emailError = validateInviteEmail(email);
    if (emailError) {
      setFieldError(emailError);
      return;
    }

    setFieldError(null);
    setIsSubmitting(true);

    const normalizedEmail = email.trim().toLowerCase();

    const response = await fetch("/api/auth/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyId: company.id,
        email: normalizedEmail,
        role
      })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "No se pudo enviar la invitación.");
      return;
    }

    setEmail("");
    setRole("COMPANY_ADMIN");
    setSuccessMessage(`Invitación enviada a ${normalizedEmail}.`);
    setShowInviteForm(false);
    router.refresh();
  }

  async function handleRevoke(invitationId: string) {
    setSubmitError(null);
    setSuccessMessage(null);
    setRevokingId(invitationId);

    const response = await fetch(`/api/auth/invitations/${invitationId}/revoke`, {
      method: "POST"
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setRevokingId(null);

    if (!response.ok) {
      setSubmitError(payload.message ?? "No se pudo revocar la invitación.");
      return;
    }

    setSuccessMessage("Invitación revocada.");
    router.refresh();
  }

  const pendingInvitations = invitations.filter((invitation) => invitation.status === "PENDING");
  const historyInvitations = invitations.filter((invitation) => invitation.status !== "PENDING");

  return (
    <div className="space-y-8">
      {signedInEmail ? (
        <p className="text-sm text-slate-500">
          Sesión iniciada como <span className="font-medium text-slate-700">{signedInEmail}</span>
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        {USERS_ACCESS_TYPES.map((accessType) => (
          <div
            key={accessType.title}
            className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm shadow-slate-200/20"
          >
            <p className="font-medium text-slate-900">{accessType.title}</p>
            <p className="mt-1">{accessType.description}</p>
          </div>
        ))}
      </div>

      <p className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
        {USERS_PIN_HELPER_COPY}
      </p>

      {successMessage ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </p>
      ) : null}

      {submitError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</p>
      ) : null}

      <section
        id="invite-user"
        className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Invitar usuario</h2>
            <p className="mt-1 text-sm text-slate-500">
              Invita administradores o supervisores con acceso web para {company.name}.
            </p>
          </div>
          {!showInviteForm ? (
            <button
              type="button"
              onClick={() => setShowInviteForm(true)}
              className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              Invitar usuario
            </button>
          ) : null}
        </div>

        {showInviteForm ? (
          <form className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={handleInvite}>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700" htmlFor="invite-email">
                Correo
              </label>
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                placeholder="usuario@compania.com"
                autoComplete="off"
                disabled={isSubmitting}
              />
              {fieldError ? <p className="mt-1.5 text-sm text-red-600">{fieldError}</p> : null}
            </div>

            <div className="sm:w-56">
              <label className="block text-sm font-medium text-slate-700" htmlFor="invite-role">
                Rol
              </label>
              <select
                id="invite-role"
                value={role}
                onChange={(event) => setRole(event.target.value as InvitableRole)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900"
                disabled={isSubmitting}
              >
                {INVITABLE_ROLES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Enviando…" : "Enviar invitación"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowInviteForm(false);
                setFieldError(null);
              }}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </form>
        ) : null}

        <p className="mt-3 text-xs text-slate-500">Las invitaciones expiran después de 7 días.</p>
      </section>

      <ActiveMembersSection companyId={company.id} members={members} signedInUserId={signedInUserId} />

      <section id="pending-invites" className="scroll-mt-24 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Invitaciones pendientes</h2>
          <p className="mt-1 text-sm text-slate-500">
            Invitaciones de usuarios web en espera de aceptación, incluyendo administradores y supervisores.
          </p>
        </div>

        {pendingInvitations.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No hay invitaciones pendientes para {company.name}.
          </p>
        ) : (
          <InvitationTable
            invitations={pendingInvitations}
            revokingId={revokingId}
            onRevoke={handleRevoke}
            showRevoke
          />
        )}
      </section>

      {historyInvitations.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Historial de invitaciones</h2>
          <InvitationTable invitations={historyInvitations} revokingId={revokingId} onRevoke={handleRevoke} />
        </section>
      ) : null}
    </div>
  );
}

type InvitationTableProps = {
  readonly invitations: UserInvitationRecord[];
  readonly revokingId: string | null;
  readonly onRevoke: (invitationId: string) => void;
  readonly showRevoke?: boolean;
};

function InvitationTable({ invitations, revokingId, onRevoke, showRevoke = false }: InvitationTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/30">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50/80">
          <tr>
            <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Correo</th>
            <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Rol</th>
            <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Estado</th>
            <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Expira</th>
            <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Invitado por</th>
            {showRevoke ? (
              <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                Acciones
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {invitations.map((invitation) => (
            <tr key={invitation.id} className="hover:bg-slate-50/50">
              <td className="px-4 py-3.5 text-slate-900">{invitation.email}</td>
              <td className="px-4 py-3.5 text-slate-700">{formatInvitationRole(invitation.role)}</td>
              <td className="px-4 py-3.5">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${invitationStatusClassName(invitation.status)}`}
                >
                  {formatInvitationStatus(invitation.status)}
                </span>
              </td>
              <td className="px-4 py-3.5 text-slate-700">
                {new Date(invitation.expiresAt).toLocaleString()}
              </td>
              <td className="px-4 py-3.5 text-slate-700">{formatInvitedByLabel(invitation.invitedBy)}</td>
              {showRevoke ? (
                <td className="px-4 py-3.5 text-right">
                  <button
                    type="button"
                    onClick={() => onRevoke(invitation.id)}
                    disabled={revokingId === invitation.id}
                    className="text-sm font-medium text-red-600 hover:text-red-700 disabled:text-slate-400"
                  >
                    {revokingId === invitation.id ? "Revocando…" : "Revocar"}
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
