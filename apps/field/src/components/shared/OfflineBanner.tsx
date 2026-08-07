"use client";

import { useEffect, useState } from "react";

import { isBrowserOffline } from "@/lib/offline";

export const OFFLINE_BANNER_COPY = "Sin conexión. Algunas funciones no están disponibles.";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(isBrowserOffline());
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) {
    return null;
  }

  return (
    <div
      className="sticky top-0 z-50 border-b border-amber-300 bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-950"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M4.606 12.97a.75.75 0 01-.134 1.051 2.494 2.494 0 000 .93 2.494 2.494 0 00-.93 0 .75.75 0 01-1.08-.54A4 4 0 1114.025 9.25a.75.75 0 01.134 1.051v-.001a4 4 0 01-2.085 3.214.75.75 0 01-1.08-.54 2.495 2.495 0 00-.93 0 2.495 2.495 0 00-.93 0 .75.75 0 01-1.08-.54A4 4 0 114.606 12.97zm5.44-1.39a.75.75 0 011.06 0 2.495 2.495 0 00-.93 0 .75.75 0 01-.54-1.08 4 4 0 102.57 3.045.75.75 0 01-.54 1.08 2.495 2.495 0 00-.93 0 .75.75 0 010-1.5z"
            clipRule="evenodd"
          />
          <path d="M10 3a.75.75 0 01.75.75v8.69l1.72-1.72a.75.75 0 111.06 1.06l-3 3a.75.75 0 01-1.06 0l-3-3a.75.75 0 011.06-1.06l1.72 1.72V3.75A.75.75 0 0110 3z" />
        </svg>
        {OFFLINE_BANNER_COPY}
      </div>
    </div>
  );
}
