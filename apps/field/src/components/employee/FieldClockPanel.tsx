"use client";

import { useCallback, useEffect, useState } from "react";

import { PrimaryActionButton } from "@/components/shared/PrimaryActionButton";
import { FIELD_CLOCK_ACTIONS, type FieldClockAction } from "@/lib/field-clock-utils";
import { fieldLocationNotReadyMessage } from "@/lib/field-messages";
import { createIdempotencyKey } from "@/lib/idempotency";
import { isBrowserOffline } from "@/lib/offline";

type ClockStatus = {
  configured: boolean;
  shiftStatus?: string | null;
  punchState?: string | null;
  allowedActions?: string[];
  workedMinutes?: number | null;
  warnings?: string[];
  message?: string;
  scheduledStartUtc?: string | null;
  scheduledEndUtc?: string | null;
  timezone?: string | null;
};

const ACTION_ENDPOINTS: Record<FieldClockAction, string> = {
  clock_in: "/api/field/clock/in",
  break_start: "/api/field/break/start",
  break_end: "/api/field/break/end",
  clock_out: "/api/field/clock/out"
};

type FieldClockPanelProps = {
  readonly compact?: boolean;
};

export function FieldClockPanel({ compact = false }: FieldClockPanelProps) {
  const [clockStatus, setClockStatus] = useState<ClockStatus | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [breakStartedAt, setBreakStartedAt] = useState<number | null>(null);
  const [breakElapsed, setBreakElapsed] = useState(0);

  const loadClockStatus = useCallback(async () => {
    setErrorMessage(null);

    const response = await fetch("/api/field/clock/status", { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as ClockStatus;

    if (!response.ok) {
      setClockStatus({
        configured: false,
        message: payload.message ?? "Unable to load shift status."
      });
      return;
    }

    setClockStatus(payload);
  }, []);

  useEffect(() => {
    void loadClockStatus();
  }, [loadClockStatus]);

  useEffect(() => {
    const currentPunchState = clockStatus?.punchState;
    if (currentPunchState === "on_break" && breakStartedAt === null) {
      setBreakStartedAt(Date.now());
      setBreakElapsed(0);
    } else if (currentPunchState !== "on_break") {
      setBreakStartedAt(null);
      setBreakElapsed(0);
    }
  }, [clockStatus?.punchState, breakStartedAt]);

  useEffect(() => {
    if (breakStartedAt === null) return;
    const interval = setInterval(() => {
      setBreakElapsed(Math.floor((Date.now() - breakStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [breakStartedAt]);

  function formatBreakElapsed(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  async function handleClockAction(action: FieldClockAction) {
    if (isBrowserOffline()) {
      setErrorMessage("You are offline. Clock actions cannot submit until your connection returns.");
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetch(ACTION_ENDPOINTS[action], {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idempotencyKey: createIdempotencyKey() })
      });

      const payload = (await response.json().catch(() => ({}))) as ClockStatus & {
        message?: string;
        duplicate?: boolean;
      };

      setIsBusy(false);

      if (!response.ok) {
        if (response.status === 409) {
          setErrorMessage(payload.message ?? "It looks like you're already clocked in or out.");
        } else if (response.status === 429) {
          setErrorMessage("Too many requests. Please wait a moment and try again.");
        } else if (response.status === 401 || response.status === 403) {
          setErrorMessage("Your session may have expired. Please sign out and sign in again.");
        } else if (response.status === 503) {
          setErrorMessage("Time clock is not available at this location.");
        } else if (response.status === 404) {
          setErrorMessage(
            payload.message ?? "No eligible shift found. Ask your supervisor to schedule a shift first."
          );
        } else {
          setErrorMessage(payload.message ?? "Clock action was rejected. Please try again.");
        }
        return;
      }

      setClockStatus({
        configured: true,
        shiftStatus: payload.shiftStatus,
        punchState: payload.punchState,
        allowedActions: payload.allowedActions,
        workedMinutes: payload.workedMinutes,
        warnings: payload.warnings
      });
      setStatusMessage(payload.message ?? `${FIELD_CLOCK_ACTIONS[action]} accepted.`);
    } catch {
      setIsBusy(false);
      setErrorMessage("Network error. Clock action was not submitted.");
    }
  }

  const allowedActions = clockStatus?.allowedActions ?? [];
  const configured = clockStatus?.configured !== false;

  return (
    <section
      className={
        compact
          ? "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          : "w-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8"
      }
    >
      <h2 className="text-xl font-semibold text-slate-900">Clock In / Clock Out</h2>
      <p className="mt-1 text-sm text-slate-600">Clock in, take breaks, and clock out for your shift.</p>

      {!configured ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          {clockStatus?.message ?? fieldLocationNotReadyMessage()}
        </p>
      ) : !clockStatus?.shiftStatus && clockStatus?.message ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          {clockStatus.message}
        </p>
      ) : (
        <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-700">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium text-slate-900">
              {clockStatus?.shiftStatus ?? "Loading…"}
            </p>
            {clockStatus?.punchState === "on_break" && breakElapsed > 0 ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                Break: {formatBreakElapsed(breakElapsed)}
              </span>
            ) : null}
          </div>
          {typeof clockStatus?.workedMinutes === "number" ? (
            <p className="text-slate-600">Work time (after breaks): {clockStatus.workedMinutes} min</p>
          ) : null}
          {!compact && clockStatus?.scheduledStartUtc && clockStatus?.scheduledEndUtc ? (
            <p className="text-slate-500">
              Scheduled:{" "}
              {(() => {
                try {
                  const start = new Date(clockStatus.scheduledStartUtc!);
                  const end = new Date(clockStatus.scheduledEndUtc!);
                  const tz = clockStatus.timezone ?? undefined;
                  const fmt = (d: Date) =>
                    d.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                      timeZone: tz
                    });
                  return `${fmt(start)} – ${fmt(end)}`;
                } catch {
                  return `${clockStatus.scheduledStartUtc} – ${clockStatus.scheduledEndUtc}`;
                }
              })()}
            </p>
          ) : null}
        </div>
      )}

      {allowedActions.length > 0 && allowedActions.length < 4 ? (
        <p className="mt-3 text-xs text-slate-500">
          {allowedActions.includes("break_start")
            ? "Only 1 unpaid break per shift."
            : "No breaks remaining."}
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-3">
        {(Object.keys(FIELD_CLOCK_ACTIONS) as FieldClockAction[]).map((action) => {
          const enabled = configured && allowedActions.includes(action);
          const isPrimary = action === "clock_in" || action === "clock_out";
          const showDisabled =
            !compact || enabled;

          if (!showDisabled) return null;

          return (
            <div key={action} className="relative">
              <PrimaryActionButton
                label={FIELD_CLOCK_ACTIONS[action]}
                disabled={isBusy || !enabled}
                variant={isPrimary ? "kiosk" : "secondary"}
                onClick={() => void handleClockAction(action)}
              />
            </div>
          );
        })}
      </div>

      {statusMessage ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {statusMessage}
        </p>
      ) : null}

      {clockStatus?.warnings?.length ? (
        <ul className="mt-4 space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {clockStatus.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {errorMessage ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
