"use client";

import { useCallback, useEffect, useState } from "react";

import type { FieldMechanicNotification } from "@/lib/field-mechanic-client";

type NotificationsPanelProps = {
  readonly onCountChange?: (unreadCount: number) => void;
};

function relativeTime(iso: string): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return "";
  }
  const deltaSeconds = Math.round((Date.now() - timestamp) / 1000);
  if (deltaSeconds < 60) return "just now";
  if (deltaSeconds < 3600) return `${Math.round(deltaSeconds / 60)}m ago`;
  if (deltaSeconds < 86400) return `${Math.round(deltaSeconds / 3600)}h ago`;
  return `${Math.round(deltaSeconds / 86400)}d ago`;
}

export function NotificationsPanel({ onCountChange }: NotificationsPanelProps) {
  const [items, setItems] = useState<FieldMechanicNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/field/notifications", { cache: "no-store" });
      const payload = (await response.json().catch(() => [])) as
        | FieldMechanicNotification[]
        | { message?: string };
      if (!response.ok) {
        const msg = (payload as { message?: string }).message ?? "Could not load notifications.";
        setError(msg);
        setItems([]);
        return;
      }
      const list = Array.isArray(payload) ? payload : [];
      setItems(list);
      const unread = list.filter((n) => !n.readAt).length;
      onCountChange?.(unread);
    } catch {
      setError("Network error while loading notifications.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleClick(item: FieldMechanicNotification) {
    if (item.readAt || markingId) return;
    setMarkingId(item.id);
    try {
      await fetch(`/api/field/notifications/${encodeURIComponent(item.id)}/read`, { method: "POST" });
      setItems((prev) => {
        const next = prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n));
        const unread = next.filter((n) => !n.readAt).length;
        onCountChange?.(unread);
        return next;
      });
    } finally {
      setMarkingId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        Loading notifications…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
        No notifications yet.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((notification) => {
        const approved = notification.type === "mechanic_approved";
        const isRead = Boolean(notification.readAt);
        return (
          <li key={notification.id}>
            <button
              type="button"
              onClick={() => void handleClick(notification)}
              disabled={markingId === notification.id}
              className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left shadow-sm transition-colors ${
                isRead
                  ? "border-slate-200 bg-slate-50 text-slate-500"
                  : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                  approved ? "bg-emerald-600" : "bg-red-600"
                }`}
                aria-hidden
              >
                {approved ? "✓" : "✕"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{notification.title}</p>
                <p className="mt-0.5 text-sm">{notification.body}</p>
                <p className="mt-1 text-xs text-slate-500">{relativeTime(notification.createdAt)}</p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
