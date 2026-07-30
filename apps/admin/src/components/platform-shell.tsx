"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  findActiveNavSectionId,
  isNavHrefActive,
  platformNavSections,
  type AdminNavSection
} from "../lib/admin-nav-config";

const enabledPlatformHrefs = new Set(["/platform/customers"]);

function PlatformNavLink({
  href,
  label,
  enabled,
  active
}: {
  readonly href: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly active: boolean;
}) {
  if (!enabled) {
    return (
      <span className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-400">
        <span>{label}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-300">Soon</span>
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`block rounded-lg px-3 py-2 text-sm transition ${
        active
          ? "bg-violet-50 font-medium text-violet-900 ring-1 ring-violet-100"
          : "font-normal text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {label}
    </Link>
  );
}

function PlatformSidebarSection({
  section,
  pathname,
  expanded,
  onToggle
}: {
  readonly section: AdminNavSection;
  readonly pathname: string;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}) {
  const enabled = section.href ? enabledPlatformHrefs.has(section.href) : false;
  const active = section.href ? isNavHrefActive(pathname, section.href) : false;

  if (section.href) {
    return (
      <PlatformNavLink href={section.href} label={section.label} enabled={enabled} active={active} />
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100"
      >
        <span>{section.label}</span>
        <span className={`text-xs text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`}>
          ›
        </span>
      </button>
      {expanded && section.items ? (
        <div className="ml-2 mt-0.5 space-y-0.5 border-l border-slate-200 pl-2">
          {section.items.map((item) => (
            <PlatformNavLink
              key={item.href}
              href={item.href}
              label={item.label}
              enabled={enabledPlatformHrefs.has(item.href)}
              active={isNavHrefActive(pathname, item.href)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

type PlatformShellProps = {
  readonly title: string;
  readonly description: string;
  readonly actions?: ReactNode;
  readonly children?: ReactNode;
};

export function PlatformShell({ title, description, actions, children }: PlatformShellProps) {
  const pathname = usePathname();
  const activeSectionId = useMemo(
    () => findActiveNavSectionId(pathname, platformNavSections),
    [pathname]
  );

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (activeSectionId) {
      initial[activeSectionId] = true;
    }
    return initial;
  });

  useEffect(() => {
    if (activeSectionId) {
      setExpandedSections((current) => ({ ...current, [activeSectionId]: true }));
    }
  }, [activeSectionId]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-screen max-w-[88rem] gap-0 lg:gap-6 lg:px-6 lg:py-6">
        <aside className="hidden w-[15.5rem] shrink-0 flex-col rounded-xl border border-violet-200/60 bg-white p-4 shadow-sm shadow-violet-100/40 md:flex">
          <div className="mb-5 border-b border-violet-100 px-2 pb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-700 text-xs font-semibold text-white">
                LL
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-violet-500">
                  LaborLedger
                </p>
                <h2 className="text-base font-semibold text-slate-900">Platform</h2>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">Superadministration</p>
          </div>

          <nav className="flex flex-col gap-1">
            {platformNavSections.map((section) => (
              <PlatformSidebarSection
                key={section.id}
                section={section}
                pathname={pathname}
                expanded={expandedSections[section.id] ?? false}
                onToggle={() =>
                  setExpandedSections((current) => ({
                    ...current,
                    [section.id]: !current[section.id]
                  }))
                }
              />
            ))}
          </nav>

          <div className="mt-6 border-t border-violet-100 pt-4">
            <Link
              href="/"
              className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              ← Back to company admin
            </Link>
          </div>

          <div className="mt-auto rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2.5 text-[11px] text-violet-600/80">
            Platform scope only
          </div>
        </aside>

        <div className="flex min-h-full flex-1 flex-col">
          <header className="border-b border-violet-200/50 bg-white px-5 py-4 lg:rounded-xl lg:border lg:shadow-sm lg:shadow-violet-100/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-violet-600">
                  Platform
                </p>
                <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                  {title}
                </h1>
                <p className="text-sm text-slate-600">{description}</p>
              </div>
              {actions ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
              ) : null}
            </div>
          </header>

          <main className="flex-1 px-5 py-6 lg:px-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
