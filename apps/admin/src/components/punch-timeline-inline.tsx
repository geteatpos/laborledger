"use client";

import { punchActionLabel } from "../lib/review-utils";
import { formatShiftTimeRange } from "../lib/shift-utils";

type PunchEvent = {
  id: string;
  action: string;
  eventUtc: string;
  isLate: boolean;
  isEarly: boolean;
};

type PunchTimelineInlineProps = {
  readonly punchEvents: PunchEvent[];
  readonly timezone: string;
};

export function PunchTimelineInline({ punchEvents, timezone }: PunchTimelineInlineProps) {
  if (!punchEvents || punchEvents.length === 0) {
    return (
      <p className="py-2 text-xs text-slate-400">No punch events recorded.</p>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <ol className="space-y-1.5">
        {punchEvents.map((event) => (
          <li key={event.id} className="flex items-center gap-3 text-xs">
            <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
              {punchActionLabel(event.action)}
            </span>
            <span className="text-slate-600">
              {formatShiftTimeRange(event.eventUtc, event.eventUtc, timezone)}
            </span>
            {event.isEarly && (
              <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700">
                Early
              </span>
            )}
            {event.isLate && (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                Late
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
