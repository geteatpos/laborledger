"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { AccessibleCompanyRecord } from "../lib/auth-utils";
import { formatChooseCompanyBlockedCopy } from "../lib/auth-utils";
import { isPlatformSuperadmin } from "../lib/platform-customer-utils";
import { MaterialIcon } from "./ui/material-icon";

type ChooseCompanyClientProps = {
  readonly companies: AccessibleCompanyRecord[];
  readonly blocked: boolean;
  readonly blockedReason?: "suspended" | "archived" | "none";
  readonly userEmail: string;
  readonly globalRole?: string;
};

export function ChooseCompanyClient({
  companies,
  blocked,
  blockedReason = "none",
  userEmail,
  globalRole
}: ChooseCompanyClientProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const showPlatformLink = globalRole ? isPlatformSuperadmin(globalRole) : false;

  const filteredCompanies = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return companies;
    }

    return companies.filter((company) => {
      const haystack = [company.name, company.accessLabel, company.currencyCode].join(" ").toLowerCase();
      return haystack.includes(normalized);
    });
  }, [companies, searchQuery]);

  async function handleSelect(companyId: string) {
    setErrorMessage(null);
    setIsSubmitting(companyId);

    const response = await fetch("/api/auth/select-company", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ companyId })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setErrorMessage(payload.message ?? "Unable to select that company.");
      setIsSubmitting(null);
      return;
    }

    router.push("/employees");
    router.refresh();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="relative min-h-screen bg-surface">
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-outline-variant bg-background/80 px-4 backdrop-blur-lg md:px-8">
        <div className="flex items-center gap-3">
          <span className="font-display text-headline-md font-black tracking-tight text-primary">
            Precision Auto
          </span>
          <div className="hidden h-6 w-px bg-outline-variant/30 md:block" />
          <span className="hidden text-label-md font-label uppercase tracking-widest text-on-surface-variant md:block">
            Company selection
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <p className="text-label-md font-label leading-none text-on-surface">{userEmail}</p>
          </div>
          <button type="button" onClick={handleLogout} className="stitch-btn-ghost">
            <MaterialIcon name="logout" className="text-[20px]" />
            <span className="hidden text-label-md font-label sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-24 md:px-8">
        <div className="pointer-events-none absolute -right-[10%] top-[-10%] h-[50%] w-[50%] rounded-full bg-primary/5 blur-[120px]" />

        <div className="relative mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="font-display text-display-lg leading-tight text-on-surface">Choose your workshop</h1>
            <p className="max-w-xl text-body-lg text-on-surface-variant">
              Select the company workspace you want to manage. You can switch later from the header.
            </p>
          </div>

          {!blocked ? (
            <div className="group relative w-full md:w-96">
              <MaterialIcon
                name="search"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by company name…"
                className="stitch-input pl-12"
              />
            </div>
          ) : null}
        </div>

        {blocked ? (
          <div className="stitch-alert-warning">{formatChooseCompanyBlockedCopy(blockedReason === "none" ? undefined : blockedReason)}</div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredCompanies.map((company) => (
              <article key={company.id} className="glass-card flex flex-col p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div className="rounded-lg bg-primary-container-20 p-2 text-primary">
                    <MaterialIcon name="precision_manufacturing" />
                  </div>
                  <span className="rounded-full bg-surface-variant px-3 py-1 text-label-sm font-label uppercase tracking-widest text-on-surface-variant">
                    {company.currencyCode}
                  </span>
                </div>

                <h3 className="font-display text-headline-md text-on-surface">{company.name}</h3>
                <p className="mt-2 flex items-center gap-1 text-on-surface-variant">
                  <MaterialIcon name="badge" className="text-sm" />
                  <span className="text-label-md font-label">{company.accessLabel}</span>
                </p>

                <div className="mt-auto space-y-4 pt-8">
                  <button
                    type="button"
                    disabled={isSubmitting !== null}
                    onClick={() => handleSelect(company.id)}
                    className="stitch-btn-primary w-full uppercase tracking-wide"
                  >
                    {isSubmitting === company.id ? "Opening…" : "Manage workshop"}
                    <MaterialIcon name="arrow_forward" className="text-[18px]" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {!blocked && filteredCompanies.length === 0 ? (
          <div className="glass-panel rounded-stitch px-6 py-12 text-center">
            <p className="text-body-md text-on-surface-variant">No companies match your search.</p>
          </div>
        ) : null}

        {errorMessage ? <p className="stitch-alert-error mt-6">{errorMessage}</p> : null}

        {showPlatformLink ? (
          <button
            type="button"
            onClick={() => {
              router.push("/platform/customers");
              router.refresh();
            }}
            className="stitch-btn-secondary mt-8"
          >
            Go to platform dashboard
          </button>
        ) : null}
      </div>
    </main>
  );
}
