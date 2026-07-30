"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AccessibleCompanyRecord, AuthMeResponse } from "../lib/auth-utils";
import { formatActiveCompanyLabel } from "../lib/auth-utils";
import { isPlatformSuperadmin } from "../lib/platform-customer-utils";
import { MaterialIcon } from "./ui/material-icon";

type AdminSessionBarProps = {
  readonly session: AuthMeResponse;
  readonly showPlatformLink?: boolean;
};

export function AdminSessionBar({ session, showPlatformLink = true }: AdminSessionBarProps) {
  const router = useRouter();
  const [isSwitching, setIsSwitching] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeCompany = session.activeCompany;
  const switchableCompanies = session.accessibleCompanies.filter(
    (company) => company.id !== activeCompany?.id
  );

  async function handleSwitchCompany(company: AccessibleCompanyRecord) {
    setErrorMessage(null);
    setIsSwitching(true);

    const response = await fetch("/api/auth/select-company", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ companyId: company.id })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setErrorMessage(payload.message ?? "Unable to switch company.");
      setIsSwitching(false);
      return;
    }

    router.refresh();
    setIsSwitching(false);
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-outline-variant/10 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-[100rem] flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex min-w-0 items-center gap-3 md:hidden">
          <span className="font-display text-base font-bold tracking-tight text-primary">Precision Auto</span>
        </div>

        <div className="hidden min-w-0 md:block">
          <p className="text-label-sm font-label uppercase tracking-widest text-on-surface-variant">
            Signed in as {session.user.email}
          </p>
          <p className="truncate text-body-sm font-medium text-on-surface">
            {formatActiveCompanyLabel(activeCompany)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showPlatformLink && isPlatformSuperadmin(session.user.globalRole) ? (
            <Link href="/platform/customers" className="stitch-btn-secondary px-3 py-2 text-xs">
              Platform admin
            </Link>
          ) : null}

          {switchableCompanies.length > 0 ? (
            <details className="relative">
              <summary className="stitch-btn-secondary cursor-pointer list-none px-3 py-2 text-xs">
                {isSwitching ? "Switching…" : "Switch company"}
              </summary>
              <div className="absolute right-0 z-20 mt-2 min-w-[16rem] rounded-stitch border border-outline-variant/20 bg-white p-2 shadow-luminous">
                <ul className="space-y-1">
                  {switchableCompanies.map((company) => (
                    <li key={company.id}>
                      <button
                        type="button"
                        disabled={isSwitching}
                        onClick={() => handleSwitchCompany(company)}
                        className="w-full rounded-lg px-3 py-2 text-left text-body-sm text-on-surface hover:bg-on-surface/5 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="block font-medium">{company.name}</span>
                        <span className="block text-xs text-on-surface-variant">{company.accessLabel}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ) : null}

          <button
            type="button"
            onClick={() => router.push("/choose-company")}
            className="stitch-btn-secondary px-3 py-2 text-xs"
          >
            Choose company
          </button>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="stitch-btn-ghost px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          >
            <MaterialIcon name="logout" className="text-[18px]" />
            {isLoggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>

      {errorMessage ? <p className="stitch-alert-error mx-4 mb-3 md:mx-6">{errorMessage}</p> : null}
    </header>
  );
}
