"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  readonly href: string;
  readonly label: string;
  readonly icon: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/field/home",
    label: "Inicio",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="9 22 9 12 15 12 15 22" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/field/work",
    label: "Trabajos",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/field/shifts",
    label: "Turnos",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="12 6 12 12 16 14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/field/summary",
    label: "Resumen",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

type BottomNavigationProps = {
  readonly activeHref?: string;
};

export function BottomNavigation({ activeHref }: BottomNavigationProps) {
  const pathname = usePathname();
  const currentHref = activeHref || pathname;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegación principal"
    >
      <div className="mx-auto flex max-w-3xl">
        {NAV_ITEMS.map((item) => {
          const isActive = currentHref.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`ll-touch-target flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors ${
                isActive
                  ? "text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
