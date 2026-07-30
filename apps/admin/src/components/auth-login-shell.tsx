import type { ReactNode } from "react";

import { MaterialIcon } from "./ui/material-icon";

type AuthLoginShellProps = {
  readonly title: string;
  readonly subtitle?: string;
  readonly children: ReactNode;
  readonly footerExtra?: ReactNode;
};

/** Stitch login card shell — Inicio de Sesión template */
export function AuthLoginShell({ title, subtitle, children, footerExtra }: AuthLoginShellProps) {
  return (
    <main className="fs-auth-screen geometric-bg">
      <section className="fs-login-card">
        <div className="flex flex-col items-center px-8 py-12 md:px-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-container text-on-primary shadow-card">
              <MaterialIcon name="directions_car" className="text-[40px]" filled />
            </div>
            <h1 className="text-headline-md font-bold tracking-tight text-primary">{title}</h1>
            {subtitle ? (
              <p className="mt-2 text-body-md text-on-surface-variant">{subtitle}</p>
            ) : null}
          </div>

          <div className="w-full">{children}</div>

          {footerExtra}

          <div className="mt-8 flex items-center gap-2 rounded-full bg-surface-container-high px-3 py-1 opacity-60">
            <MaterialIcon name="lock" className="text-[16px]" filled />
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface">
              Secure Infrastructure
            </span>
          </div>
        </div>

        <footer className="flex items-center justify-between bg-surface-container px-8 py-4 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant/60 md:px-10">
          <span>© {new Date().getFullYear()} Management System</span>
          <div className="flex gap-4">
            <span className="hover:text-primary">Términos</span>
            <span className="hover:text-primary">Privacidad</span>
          </div>
        </footer>
      </section>
    </main>
  );
}
