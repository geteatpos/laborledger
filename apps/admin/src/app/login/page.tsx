"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { resolveLoginRedirectPath, type AuthLoginResponse } from "../../lib/auth-utils";
import { MaterialIcon } from "../../components/ui/material-icon";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const payload = (await response.json().catch(() => ({}))) as AuthLoginResponse & {
      message?: string;
    };

    if (!response.ok) {
      setErrorMessage(payload.message ?? "Unable to sign in.");
      setIsSubmitting(false);
      return;
    }

    router.push(resolveLoginRedirectPath(payload.redirectTo));
    router.refresh();
  }

  return (
    <main className="relative flex min-h-dvh bg-surface">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[10%] top-[-10%] h-[50%] w-[50%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-primary-container/50 blur-[100px]" />
      </div>

      <section className="relative hidden w-[44%] flex-col justify-between border-r border-outline-variant/10 p-14 lg:flex">
        <div>
          <div className="flex h-12 w-12 items-center justify-center rounded-stitch bg-primary-container text-primary">
            <MaterialIcon name="precision_manufacturing" className="text-2xl" filled />
          </div>
          <h1 className="mt-10 font-display text-display-lg text-on-surface">Precision Auto Ledger</h1>
          <p className="mt-4 max-w-sm text-body-lg leading-relaxed text-on-surface-variant">
            AutoBody management suite for workforce operations, client billing, and shop productivity.
          </p>
        </div>
        <div className="space-y-2 text-label-sm text-on-surface-variant">
          <p>Secure HttpOnly sessions</p>
          <p>Tenant-scoped access · Multi-company</p>
        </div>
      </section>

      <section className="relative flex w-full flex-col justify-center px-6 py-12 lg:w-[56%] lg:px-20">
        <div className="mx-auto w-full max-w-md">
          <div className="glass-panel rounded-stitch p-8 shadow-luminous lg:p-10">
            <div className="lg:hidden">
              <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-stitch bg-primary-container text-primary">
                <MaterialIcon name="precision_manufacturing" filled />
              </div>
            </div>

            <p className="text-label-sm font-label uppercase tracking-widest text-on-surface-variant">
              Inicio de sesión
            </p>
            <h2 className="mt-2 font-display text-headline-md text-on-surface">Welcome back</h2>
            <p className="mt-2 text-body-sm text-on-surface-variant">
              Sign in to your account to continue.
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
              <div>
                <label className="stitch-label mb-2 block" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="stitch-input"
                  placeholder="name@company.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="stitch-label" htmlFor="password">
                    Password
                  </label>
                  <Link href="/forgot-password" className="text-body-sm font-medium text-primary hover:underline">
                    Forgot?
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="stitch-input"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </div>

              {errorMessage ? <div className="stitch-alert-error">{errorMessage}</div> : null}

              <button type="submit" disabled={isSubmitting} className="stitch-btn-primary w-full">
                {isSubmitting ? (
                  "Signing in…"
                ) : (
                  <>
                    Sign in
                    <MaterialIcon name="arrow_forward" className="text-[18px]" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
