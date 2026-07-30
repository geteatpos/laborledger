"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { SUPERVISORS_LOCATION_HELP_COPY } from "../lib/employees-module-copy";
import type { LocationOption } from "../lib/supervisor-assignment-utils";
import { validateInviteEmail } from "../lib/user-invite-utils";

type AddSupervisorFormProps = {
  readonly companyId: string;
  readonly companyName: string;
  readonly locations: LocationOption[];
  readonly onCancel?: () => void;
};

export function AddSupervisorForm({
  companyId,
  companyName,
  locations,
  onCancel
}: AddSupervisorFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setFieldError("Name is required.");
      return;
    }

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
        companyId,
        email: normalizedEmail,
        role: "SUPERVISOR"
      })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to send supervisor invitation.");
      return;
    }

    setFullName("");
    setEmail("");
    setSuccessMessage("Supervisor invited. Assign location access after they accept the invitation.");
    router.refresh();
  }

  const usersAccessHref = `/users?companyId=${encodeURIComponent(companyId)}#supervisor-access`;

  return (
    <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Add supervisor</h2>
          <p className="mt-1 text-sm text-slate-500">
            Send a web access invitation for {companyName}. Invitations expire after 7 days.
          </p>
        </div>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Close
          </button>
        ) : null}
      </div>

      <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
            Supervisor details
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="supervisor-name">
                Name
              </label>
              <input
                id="supervisor-name"
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                placeholder="Jane Supervisor"
                autoComplete="name"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="supervisor-email">
                Email
              </label>
              <input
                id="supervisor-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                placeholder="supervisor@company.com"
                autoComplete="off"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="mt-4 sm:max-w-xs">
            <label className="block text-sm font-medium text-slate-700" htmlFor="supervisor-role">
              Role
            </label>
            <input
              id="supervisor-role"
              type="text"
              value="Supervisor"
              readOnly
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-slate-700"
            />
          </div>

          {fieldError ? <p className="mt-2 text-sm text-red-600">{fieldError}</p> : null}
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Location access</p>
          <p className="mt-2 text-sm text-slate-600">{SUPERVISORS_LOCATION_HELP_COPY}</p>
          {locations.filter((location) => !location.archivedAt).length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              Create a location first, then assign access in Roles &amp; Access after the invite is accepted.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? "Sending invite…" : "Send invite"}
          </button>
        </div>
      </form>

      {successMessage ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p>{successMessage}</p>
          <Link href={usersAccessHref} className="mt-2 inline-block font-medium text-emerald-900 underline">
            Review location access
          </Link>
        </div>
      ) : null}

      {submitError ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </p>
      ) : null}
    </div>
  );
}
