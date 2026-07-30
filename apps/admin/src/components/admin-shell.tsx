import type { ReactNode } from "react";

import { AdminNav } from "./admin-nav";

type AdminShellProps = {
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
  readonly children?: ReactNode;
};

export function AdminShell({ title, description, actions, children }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-page text-on-surface">
      <div className="mx-auto flex min-h-screen max-w-[100rem]">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-outline-variant bg-white p-6 md:flex">
          <div className="mb-8">
            <h2 className="font-display text-[24px] font-bold tracking-tight text-primary">
              Precision Auto
            </h2>
            <p className="mt-1 text-[12px] font-medium uppercase tracking-widest text-on-surface-variant/60">
              Shop Manager
            </p>
          </div>

          <AdminNav variant="sidebar" />

          <div className="mt-auto rounded-lg border border-outline-variant bg-page px-3 py-2.5 text-[12px] text-on-surface-variant">
            Workforce & billing operations
          </div>
        </aside>

        <div className="flex min-h-screen w-full flex-1 flex-col md:pl-64">
          <header className="stitch-page-header">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <h1 className="truncate font-display text-[24px] tracking-tight text-on-surface sm:text-[32px]">
                  {title}
                </h1>
                {description ? (
                  <p className="max-w-3xl text-[16px] leading-relaxed text-on-surface-variant">
                    {description}
                  </p>
                ) : null}
              </div>
              {actions ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
              ) : null}
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
