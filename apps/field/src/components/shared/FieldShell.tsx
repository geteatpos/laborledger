import Link from "next/link";
import type { ReactNode } from "react";

type FieldShellProps = {
  readonly title: string;
  readonly subtitle?: string;
  readonly children: ReactNode;
  readonly showHomeLink?: boolean;
  readonly actions?: ReactNode;
};

export function FieldShell({ title, subtitle, children, showHomeLink = true, actions }: FieldShellProps) {
  return (
    <div className="min-h-screen pt-[max(0px,env(safe-area-inset-top))] pb-[max(0px,env(safe-area-inset-bottom))]">
      <header className="ll-page-header sticky top-0 z-30">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                LaborLedger
              </p>
              {actions && (
                <div className="ml-auto flex items-center gap-2">
                  {actions}
                </div>
              )}
            </div>
            <h1 className="ll-page-title">{title}</h1>
            {subtitle && <p className="ll-page-subtitle">{subtitle}</p>}
          </div>
          {showHomeLink && (
            <Link
              href="/field/home"
              className="ll-btn-secondary shrink-0 text-xs"
            >
              Home
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
