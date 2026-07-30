"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  companyAdminNavSections,
  findActiveNavSectionId,
  getNavIcon,
  isNavHrefActive,
  type AdminNavSection
} from "../lib/admin-nav-config";
import { MaterialIcon } from "./ui/material-icon";

function NavLink({
  href,
  label,
  active,
  isSidebar,
  icon
}: {
  readonly href: string;
  readonly label: string;
  readonly active: boolean;
  readonly isSidebar: boolean;
  readonly icon?: string | undefined;
}) {
  if (isSidebar) {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={active ? "stitch-nav-active" : "stitch-nav-item"}
      >
        {icon ? <MaterialIcon name={icon} className="text-[20px]" filled={active} /> : null}
        <span className="text-label-md font-label">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`block whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
        active
          ? "bg-primary-container font-medium text-primary"
          : "font-normal text-on-surface-variant hover:bg-surface-variant hover:text-on-surface"
      }`}
    >
      {label}
    </Link>
  );
}

function SidebarSection({
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
  const sectionActive =
    (section.href && isNavHrefActive(pathname, section.href)) ||
    section.items?.some((item) => isNavHrefActive(pathname, item.href));
  const icon = getNavIcon(section.id);

  if (section.href && !section.items) {
    return (
      <NavLink
        href={section.href}
        label={section.label}
        active={isNavHrefActive(pathname, section.href)}
        isSidebar
        {...(icon ? { icon } : {})}
      />
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-[14px] font-medium transition ${
          sectionActive
            ? "text-on-surface"
            : "text-on-surface-variant hover:bg-surface-variant hover:text-on-surface"
        }`}
      >
        <span className="flex items-center gap-3">
          {icon ? <MaterialIcon name={icon} className="text-[20px]" /> : null}
          {section.label}
        </span>
        <MaterialIcon
          name="chevron_right"
          className={`text-base text-on-surface-variant transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {expanded && section.items ? (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-outline-variant pl-3">
          {section.items.map((item) => {
            const itemIcon = getNavIcon(item.href);
            return (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={isNavHrefActive(pathname, item.href)}
                isSidebar
                {...(itemIcon ? { icon: itemIcon } : {})}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

type AdminNavProps = {
  readonly variant?: "sidebar" | "mobile";
};

export function AdminNav({ variant = "mobile" }: AdminNavProps) {
  const pathname = usePathname();
  const isSidebar = variant === "sidebar";
  const activeSectionId = useMemo(
    () => findActiveNavSectionId(pathname, companyAdminNavSections),
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

  function toggleSection(sectionId: string) {
    setExpandedSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId]
    }));
  }

  if (!isSidebar) {
    const mobileItems = companyAdminNavSections.flatMap((section) => {
      if (section.href && !section.items) {
        return [{ href: section.href, label: section.label }];
      }

      return section.items ?? [];
    });

    return (
      <nav className="flex flex-row gap-1 overflow-x-auto pb-1">
        {mobileItems.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            active={isNavHrefActive(pathname, item.href)}
            isSidebar={false}
          />
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
      {companyAdminNavSections.map((section) => (
        <SidebarSection
          key={section.id}
          section={section}
          pathname={pathname}
          expanded={expandedSections[section.id] ?? false}
          onToggle={() => toggleSection(section.id)}
        />
      ))}
    </nav>
  );
}
