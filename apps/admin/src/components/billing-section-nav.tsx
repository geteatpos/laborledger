"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { billingSectionNavItems, isNavHrefActive } from "../lib/admin-nav-config";

export function BillingSectionNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Billing sections"
      className="mb-6 flex flex-wrap gap-1 rounded-xl border border-slate-200/80 bg-white p-1 shadow-sm shadow-slate-200/20"
    >
      {billingSectionNavItems.map((item) => {
        const active = isNavHrefActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3.5 py-2 text-sm transition ${
              active
                ? "bg-slate-900 font-medium text-white shadow-sm"
                : "font-normal text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
