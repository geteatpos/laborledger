import { BadRequestException } from "@nestjs/common";

import {
  addDaysToDateKey,
  DEFAULT_TIMEZONE,
  localDateTimeInTimeZoneToUtcIso
} from "../weekly-close/week-period";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
export const MAX_FINANCIAL_REPORT_RANGE_DAYS = 366;

export type FinancialReportDateRange = {
  from: string;
  to: string;
  timezone: string;
  fromUtc: Date;
  toUtcExclusive: Date;
};

export type FinancialPeriodPreset = "7d" | "30d" | "90d" | "year" | "custom";

function parseDateKey(value: string, label: string) {
  if (!DATE_KEY_PATTERN.test(value)) {
    throw new BadRequestException(`${label} must use YYYY-MM-DD format.`);
  }

  const parts = value.split("-").map((part) => Number(part));
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 0;
  const day = parts[2] ?? 0;
  const utc = new Date(Date.UTC(year, month - 1, day));

  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new BadRequestException(`${label} is not a valid calendar date.`);
  }

  return { year, month, day };
}

function formatDateKeyFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function zonedTodayDateKey(timezone: string, now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(now);
}

function daysBetweenInclusive(from: string, to: string) {
  const fromMs = Date.parse(`${from}T00:00:00.000Z`);
  const toMs = Date.parse(`${to}T00:00:00.000Z`);
  return Math.floor((toMs - fromMs) / (24 * 60 * 60 * 1000)) + 1;
}

export function resolveFinancialTimezone(timezone?: string) {
  const trimmed = timezone?.trim();
  if (!trimmed) {
    return DEFAULT_TIMEZONE;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return trimmed;
  } catch {
    throw new BadRequestException("timezone is not a valid IANA time zone.");
  }
}

export function resolveFinancialReportDateRange(input: {
  from?: string;
  to?: string;
  timezone?: string;
  preset?: string;
  now?: Date;
}): FinancialReportDateRange {
  const timezone = resolveFinancialTimezone(input.timezone);
  const now = input.now ?? new Date();
  const today = zonedTodayDateKey(timezone, now);
  const preset = (input.preset?.trim() || "custom") as FinancialPeriodPreset | "custom";

  let from = input.from?.trim() || "";
  let to = input.to?.trim() || "";

  if (preset === "7d") {
    to = today;
    from = addDaysToDateKey(today, -6);
  } else if (preset === "30d") {
    to = today;
    from = addDaysToDateKey(today, -29);
  } else if (preset === "90d") {
    to = today;
    from = addDaysToDateKey(today, -89);
  } else if (preset === "year") {
    to = today;
    from = `${today.slice(0, 4)}-01-01`;
  } else {
    if (!from || !to) {
      to = to || today;
      from = from || addDaysToDateKey(to, -29);
    }
  }

  parseDateKey(from, "from");
  parseDateKey(to, "to");

  if (from > to) {
    throw new BadRequestException("from must be on or before to.");
  }

  const rangeDays = daysBetweenInclusive(from, to);
  if (rangeDays > MAX_FINANCIAL_REPORT_RANGE_DAYS) {
    throw new BadRequestException(
      `Date range cannot exceed ${MAX_FINANCIAL_REPORT_RANGE_DAYS} days.`
    );
  }

  const fromUtc = new Date(localDateTimeInTimeZoneToUtcIso(from, "00:00", timezone));
  const toExclusiveKey = addDaysToDateKey(to, 1);
  const toUtcExclusive = new Date(localDateTimeInTimeZoneToUtcIso(toExclusiveKey, "00:00", timezone));

  return {
    from,
    to,
    timezone,
    fromUtc,
    toUtcExclusive
  };
}

export function previousPeriodRange(range: FinancialReportDateRange): FinancialReportDateRange {
  const lengthDays = daysBetweenInclusive(range.from, range.to);
  const previousTo = addDaysToDateKey(range.from, -1);
  const previousFrom = addDaysToDateKey(previousTo, -(lengthDays - 1));

  return resolveFinancialReportDateRange({
    from: previousFrom,
    to: previousTo,
    timezone: range.timezone,
    preset: "custom"
  });
}

export function resolveTrendInterval(
  range: FinancialReportDateRange,
  interval?: string
): "day" | "week" | "month" {
  const requested = interval?.trim().toLowerCase();
  if (requested === "day" || requested === "week" || requested === "month") {
    return requested;
  }

  const lengthDays = daysBetweenInclusive(range.from, range.to);
  if (lengthDays <= 45) {
    return "day";
  }
  if (lengthDays <= 120) {
    return "week";
  }
  return "month";
}

export function buildPeriodKeys(
  range: FinancialReportDateRange,
  interval: "day" | "week" | "month"
): string[] {
  const keys: string[] = [];

  if (interval === "day") {
    let cursor = range.from;
    while (cursor <= range.to) {
      keys.push(cursor);
      cursor = addDaysToDateKey(cursor, 1);
    }
    return keys;
  }

  if (interval === "week") {
    let cursor = range.from;
    while (cursor <= range.to) {
      keys.push(cursor);
      cursor = addDaysToDateKey(cursor, 7);
    }
    return keys;
  }

  const startParts = range.from.split("-").map(Number);
  const endParts = range.to.split("-").map(Number);
  let year = startParts[0] ?? 0;
  let month = startParts[1] ?? 1;
  const endYear = endParts[0] ?? year;
  const endMonth = endParts[1] ?? month;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return keys;
}

export function periodKeyForInstant(
  instant: Date,
  timezone: string,
  interval: "day" | "week" | "month",
  weekStarts: string[]
) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const dateKey = formatter.format(instant);

  if (interval === "day") {
    return dateKey;
  }

  if (interval === "month") {
    return dateKey.slice(0, 7);
  }

  let matched = weekStarts[0] ?? dateKey;
  for (const start of weekStarts) {
    if (start <= dateKey) {
      matched = start;
    } else {
      break;
    }
  }
  return matched;
}

export function formatDateKeyUtc(year: number, month: number, day: number) {
  return formatDateKeyFromParts(year, month, day);
}
