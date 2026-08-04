"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { BottomNavigation } from "@/components/shared/BottomNavigation";
import { ErrorState } from "@/components/shared/ErrorState";
import { SkeletonCard } from "@/components/shared/SkeletonCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatusCard } from "@/components/shared/StatusCard";
import { fieldLocationNotReadyMessage } from "@/lib/field-messages";

const FIELD_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

type FieldMeResponse = {
  session?: {
    employeeName: string;
    companyName: string;
    issuedAt?: number;
  };
  clockConfigured?: boolean;
  message?: string;
};

type ClockStatusLine = {
  shiftStatus: string | null;
  scheduledStartUtc?: string | null;
  scheduledEndUtc?: string | null;
  timezone?: string | null;
};

function formatScheduledTimeRange(
  startUtc: string | null | undefined,
  endUtc: string | null | undefined,
  timezone: string | null | undefined
): string | null {
  if (!startUtc || !endUtc) return null;
  try {
    const start = new Date(startUtc);
    const end = new Date(endUtc);
    const tz = timezone ?? undefined;
    const fmt = (d: Date) =>
      d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: tz,
      });
    return `${fmt(start)} – ${fmt(end)}`;
  } catch {
    return null;
  }
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="12 6 12 12 16 14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WorkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReceiveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 16a2 2 0 100-4 2 2 0 000 4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const HOME_ACTIONS = [
  {
    href: "/field/jobs/new",
    label: "Recibir Vehículo",
    description: "Escanear VIN o ingresar manualmente",
    icon: <ReceiveIcon className="h-6 w-6" />,
    primary: true,
    accent: "blue",
  },
  {
    href: "/field/work",
    label: "Mis Trabajos",
    description: "Ver trabajos y servicios asignados",
    icon: <WorkIcon className="h-6 w-6" />,
    primary: true,
    accent: "emerald",
  },
  {
    href: "/field/shifts",
    label: "Mis Turnos",
    description: "Ver horario e historial de reloj",
    icon: <ClockIcon className="h-6 w-6" />,
    primary: false,
    accent: "slate",
  },
  {
    href: "/field/summary",
    label: "Resumen",
    description: "Revisar trabajo del día",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    primary: false,
    accent: "slate",
  },
] as const;

const ACCENT_COLORS = {
  blue: {
    bg: "bg-blue-600",
    bgLight: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-600",
    textLight: "text-blue-700",
  },
  emerald: {
    bg: "bg-emerald-600",
    bgLight: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-600",
    textLight: "text-emerald-700",
  },
  slate: {
    bg: "bg-slate-600",
    bgLight: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-600",
    textLight: "text-slate-700",
  },
};

export function FieldHomePanel() {
  const router = useRouter();
  const [me, setMe] = useState<FieldMeResponse | null>(null);
  const [clockLine, setClockLine] = useState<ClockStatusLine | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sessionMinutesLeft, setSessionMinutesLeft] = useState<number | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  const loadMe = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/field/me", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as FieldMeResponse & {
        message?: string;
      };

      if (!response.ok) {
        if (response.status === 401) {
          router.replace("/field/login");
          router.refresh();
          return;
        }
        setErrorMessage(payload.message ?? "No se pudo cargar tu sesión.");
        return;
      }

      setMe(payload);

      if (payload.clockConfigured) {
        const clockResponse = await fetch("/api/field/clock/status", { cache: "no-store" });
        const clockPayload = (await clockResponse.json().catch(() => ({}))) as {
          shiftStatus?: string | null;
          scheduledStartUtc?: string | null;
          scheduledEndUtc?: string | null;
          timezone?: string | null;
        };
        if (clockResponse.ok) {
          setClockLine({
            shiftStatus: clockPayload.shiftStatus ?? null,
            scheduledStartUtc: clockPayload.scheduledStartUtc ?? null,
            scheduledEndUtc: clockPayload.scheduledEndUtc ?? null,
            timezone: clockPayload.timezone ?? null,
          });
        }
      }
    } catch {
      setErrorMessage("Error de conexión. Verifica tu red.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    function handleClickAway(event: MouseEvent) {
      if (!notificationsOpen) return;
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, [notificationsOpen]);

  useEffect(() => {
    if (!me?.session?.issuedAt) {
      setSessionMinutesLeft(null);
      return;
    }
    function updateCountdown() {
      const issuedAt = me?.session?.issuedAt;
      if (issuedAt == null) {
        setSessionMinutesLeft(null);
        return;
      }
      const remaining = Math.max(
        0,
        Math.floor((issuedAt + FIELD_SESSION_TTL_MS - Date.now()) / 60000)
      );
      setSessionMinutesLeft(remaining);
    }
    updateCountdown();
    const interval = setInterval(updateCountdown, 30_000);
    return () => clearInterval(interval);
  }, [me?.session?.issuedAt]);

  async function handleSignOut() {
    setIsSigningOut(true);
    await fetch("/api/field/logout", { method: "POST" });
    router.replace("/field/login");
    router.refresh();
  }

  const firstName = me?.session?.employeeName?.split(" ")[0];
  const initials = me?.session?.employeeName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const clockReady = me?.clockConfigured === true;
  const shiftStatus = clockLine?.shiftStatus?.toLowerCase() ?? null;
  const onShift = shiftStatus === "on shift" || shiftStatus === "clocked in";

  if (isLoading) {
    return (
      <div className="space-y-4 pb-20">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={2} />
      </div>
    );
  }

  if (errorMessage && !me) {
    return (
      <div className="space-y-4 pb-20">
        <ErrorState message={errorMessage} onRetry={() => void loadMe()} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="ll-card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
              {initials ?? "?"}
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900">
                {firstName ? `Hola, ${firstName}` : "Bienvenido"}
              </p>
              <p className="text-sm text-slate-500">{me?.session?.companyName ?? ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sessionMinutesLeft !== null && sessionMinutesLeft <= 60 && (
              <span className="ll-badge-warning">
                Sesión {sessionMinutesLeft}m
              </span>
            )}
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={isSigningOut}
              className="ll-btn-ghost text-xs"
            >
              {isSigningOut ? "Saliendo..." : "Salir"}
            </button>
          </div>
        </div>

        {clockReady && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${onShift ? "bg-emerald-100" : "bg-slate-200"}`}>
                  <ClockIcon className={`h-5 w-5 ${onShift ? "text-emerald-600" : "text-slate-500"}`} />
                </div>
                <div>
                  <StatusBadge
                    label={shiftStatus ? shiftStatus.charAt(0).toUpperCase() + shiftStatus.slice(1) : "Sin turno"}
                    tone={onShift ? "success" : "neutral"}
                  />
                  {clockLine?.scheduledStartUtc && clockLine?.scheduledEndUtc && (
                    <p className="mt-1 text-xs text-slate-500">
                      Turno: {formatScheduledTimeRange(clockLine.scheduledStartUtc, clockLine.scheduledEndUtc, clockLine.timezone) ?? `${clockLine.scheduledStartUtc} – ${clockLine.scheduledEndUtc}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!clockReady && me && (
          <div className="mt-4">
            <StatusCard
              title="Reloj no configurado"
              description={fieldLocationNotReadyMessage()}
              tone="warning"
            />
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Acciones rápidas
        </h2>
        <div className="space-y-3">
          {HOME_ACTIONS.map((action) => {
            const colors = ACCENT_COLORS[action.accent];
            return (
              <Link
                key={action.href}
                href={action.href}
                className={`ll-card-interactive flex items-center gap-4 ${action.primary ? "border-2" : ""}`}
                style={{
                  borderColor: action.primary ? undefined : undefined,
                }}
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${colors.bg} text-white`}
                >
                  {action.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{action.label}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{action.description}</p>
                </div>
                <svg className="h-5 w-5 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </Link>
            );
          })}
        </div>
      </div>

      {errorMessage && me && (
        <ErrorState message={errorMessage} onRetry={() => void loadMe()} />
      )}

      <BottomNavigation activeHref="/field/home" />
    </div>
  );
}
