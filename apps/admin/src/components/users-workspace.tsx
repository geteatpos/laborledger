"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import type { AccessibleCompanyRecord } from "../lib/auth-utils";
import {
  formatInvitedByLabel,
  formatInvitationRole,
  formatInvitationStatus,
  invitationStatusClassName,
  USERS_PIN_HELPER_COPY,
  USERS_ACCESS_TYPES,
  validateInviteEmail,
  type UserInvitationRecord
} from "../lib/user-invite-utils";

type UsersWorkspaceProps = {
  readonly company: AccessibleCompanyRecord;
  readonly invitations: UserInvitationRecord[];
  readonly signedInEmail?: string;
};

export function UsersWorkspace({ company, invitations, signedInEmail }: UsersWorkspaceProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
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

    const response = await fetch("/api/auth/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyId: company.id,
        email: email.trim().toLowerCase(),
        role: "COMPANY_ADMIN"
      })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to send invitation.");
      return;
    }

    setEmail("");
    setSuccessMessage(`Invitation sent to ${email.trim().toLowerCase()}.`);
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
      setSubmitError(payload.message ?? "Unable to revoke invitation.");
      return;
    }

    setSuccessMessage("Invitation revoked.");
    router.refresh();
  }

  const pendingInvitations = invitations.filter((invitation) => invitation.status === "PENDING");
  const historyInvitations = invitations.filter((invitation) => invitation.status !== "PENDING");

  return (
    <div className="space-y-8">
      {signedInEmail ? (
        <p className="text-sm text-slate-500">
          Signed in as <span className="font-medium text-slate-700">{signedInEmail}</span>
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
        id="company-admins"
        className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30"
      >
        <h2 className="text-sm font-semibold text-slate-900">Company admins</h2>
        <p className="mt-1 text-sm text-slate-500">
          Invite web users with full company management access for {company.name}.
        </p>

        <form className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={handleInvite}>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700" htmlFor="invite-email">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              placeholder="admin@company.com"
              autoComplete="off"
              disabled={isSubmitting}
            />
            {fieldError ? <p className="mt-1.5 text-sm text-red-600">{fieldError}</p> : null}
          </div>

          <div className="sm:w-48">
            <label className="block text-sm font-medium text-slate-700" htmlFor="invite-role">
              Role
            </label>
            <input
              id="invite-role"
              type="text"
              value="Company admin"
              readOnly
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-slate-700"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? "Sending…" : "Send invitation"}
          </button>
        </form>

        <p className="mt-3 text-xs text-slate-500">Invitations expire after 7 days.</p>
      </section>

      <section id="pending-invites" className="scroll-mt-24 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Pending invites</h2>
          <p className="mt-1 text-sm text-slate-500">
            Web user invitations awaiting acceptance, including company admins and supervisors.
          </p>
        </div>

        {pendingInvitations.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No pending invitations for {company.name}.
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
          <h2 className="text-sm font-semibold text-slate-900">Invitation history</h2>
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
            <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Email</th>
            <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Role</th>
            <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Status</th>
            <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Expires</th>
            <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Invited by</th>
            {showRevoke ? (
              <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                Actions
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
                    {revokingId === invitation.id ? "Revoking…" : "Revoke"}
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
