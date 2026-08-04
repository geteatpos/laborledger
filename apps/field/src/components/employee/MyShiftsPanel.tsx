"use client";

import { useCallback, useEffect, useState } from "react";

import { SkeletonCard } from "@/components/shared/SkeletonCard";
import { StatusCard } from "@/components/shared/StatusCard";

type ShiftPunchEvent = {
  action: string;
  eventUtc: string;
};

type Shift = {
  id: string;
  status: string;
  scheduledStartUtc: string;
  scheduledEndUtc: string;
  timezone: string;
  locationName: string;
  clockInUtc: string | null;
  clockOutUtc: string | null;
  breakCount: number;
  workedMinutes: number | null;
  punchEvents: ShiftPunchEvent[];
};

type ShiftsPayload = {
  shifts: Shift[];
  message?: string;
};

function formatDate(iso: string, timezone: string | null): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: timezone ?? undefined
    });
  } catch {
    return iso;
  }
}

function formatTime(iso: string | null, timezone: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone ?? undefined
    });
  } catch {
    return iso;
  }
}

function formatWorkedMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function groupShiftsByDate(shifts: Shift[], timezone: string | null): Map<string, Shift[]> {
  const groups = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const dateKey = formatDate(shift.scheduledStartUtc, timezone);
    const existing = groups.get(dateKey) ?? [];
    groups.set(dateKey, [...existing, shift]);
  }
  return groups;
}

function ShiftRow({ shift, timezone }: { shift: Shift; timezone: string | null }) {
  const isCancelled = shift.status === "CANCELLED";

  return (
    <div
      className={`rounded-xl border p-4 text-sm ${isCancelled ? "border-slate-200 bg-slate-50 opacity-60" : "border-slate-200 bg-white"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-900">
              {formatTime(shift.scheduledStartUtc, timezone)} – {formatTime(shift.scheduledEndUtc, timezone)}
            </p>
            {isCancelled && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                Cancelled
              </span>
            )}
          </div>
          <p className="mt-1 text-slate-500">
            {shift.clockInUtc || shift.clockOutUtc ? (
              <>
                Clocked: {formatTime(shift.clockInUtc, timezone)} → {formatTime(shift.clockOutUtc, timezone)}
              </>
            ) : (
              <>Not clocked in</>
            )}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {shift.workedMinutes !== null ? (
            <p className="font-semibold text-slate-900">{formatWorkedMinutes(shift.workedMinutes)}</p>
          ) : null}
          {shift.breakCount > 0 ? (
            <p className="mt-0.5 text-xs text-slate-400">{shift.breakCount} break{shift.breakCount !== 1 ? "s" : ""}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function MyShiftsPanel() {
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadShifts = useCallback(async () => {
    setError(null);
    const response = await fetch("/api/field/shifts", { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as ShiftsPayload;

    if (!response.ok) {
      setError(payload.message ?? "Unable to load shifts.");
      return;
    }

    setShifts(payload.shifts ?? []);
  }, []);

  useEffect(() => {
    void loadShifts();
  }, [loadShifts]);

  if (error) {
    return (
      <div className="space-y-3">
        <StatusCard title="Unable to load shifts" description={error} tone="warning" />
        <button
          type="button"
          onClick={() => void loadShifts()}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100"
        >
          Try again
        </button>
      </div>
    );
  }

  if (shifts === null) {
    return <SkeletonCard lines={4} />;
  }

  if (shifts.length === 0) {
    return (
      <StatusCard
        title="No shifts found"
        description="You have no scheduled shifts in the visible period."
        tone="neutral"
      />
    );
  }

  const timezone = shifts[0]?.timezone ?? null;
  const grouped = groupShiftsByDate(shifts, timezone);

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([dateLabel, dateShifts]) => (
        <div key={dateLabel}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{dateLabel}</p>
          <div className="space-y-2">
            {dateShifts.map((shift) => (
              <ShiftRow key={shift.id} shift={shift} timezone={timezone} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
