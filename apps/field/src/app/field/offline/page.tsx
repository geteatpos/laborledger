import Link from "next/link";

import { FieldShell } from "@/components/shared/FieldShell";
import { StatusCard } from "@/components/shared/StatusCard";

export default function FieldOfflinePage() {
  return (
    <FieldShell title="Offline" subtitle="You are currently offline.">
      <div className="space-y-4">
        <StatusCard
          title="Connection required"
          description="Clock actions, vehicle scans, and service completions need an internet connection. Your data will sync when you're back online."
          tone="warning"
        />
        <Link
          href="/field/home"
          className="inline-flex rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100"
        >
          Back to Home
        </Link>
      </div>
    </FieldShell>
  );
}
