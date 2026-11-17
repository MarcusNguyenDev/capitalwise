const CURRENCY_FORMATTER = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });
const TIME_FORMATTER = new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", second: "2-digit" });
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const DATE_FORMATTER = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric" });

export function formatCurrency(amount: number | string | null | undefined): string {
  return amount === null || amount === undefined ? "–" : CURRENCY_FORMATTER.format(Number(amount));
}

export function formatClockTime(timestamp: string | null | undefined): string {
  return timestamp ? TIME_FORMATTER.format(new Date(timestamp)) : "–";
}

export function formatDateTime(timestamp: string | null | undefined): string {
  return timestamp ? DATE_TIME_FORMATTER.format(new Date(timestamp)) : "–";
}

/** For plain `YYYY-MM-DD` dates such as the 21-day hardship deadline. */
export function formatCalendarDate(calendar_date: string | null | undefined): string {
  return calendar_date ? DATE_FORMATTER.format(new Date(`${calendar_date.slice(0, 10)}T00:00:00`)) : "–";
}

/** 95 -> "1:35" */
export function formatDuration(total_seconds: number): string {
  const safe_seconds = Math.max(0, Math.round(total_seconds));
  const minutes = Math.floor(safe_seconds / 60);
  const seconds = safe_seconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** 5400 -> "1h 30m", 95 -> "1m 35s" */
export function formatLongDuration(total_seconds: number): string {
  const safe_seconds = Math.max(0, Math.round(total_seconds));
  if (safe_seconds >= 3600) {
    return `${Math.floor(safe_seconds / 3600)}h ${Math.floor((safe_seconds % 3600) / 60)}m`;
  }
  if (safe_seconds >= 60) {
    return `${Math.floor(safe_seconds / 60)}m ${safe_seconds % 60}s`;
  }
  return `${safe_seconds}s`;
}

export function formatMilliseconds(milliseconds: number | null | undefined): string {
  if (milliseconds === null || milliseconds === undefined) {
    return "–";
  }
  return milliseconds >= 10000 ? `${(milliseconds / 1000).toFixed(0)} s` : milliseconds >= 1000 ? `${(milliseconds / 1000).toFixed(1)} s` : `${Math.round(milliseconds)} ms`;
}

/** "REFUND_FEE" -> "Refund fee" */
export function formatCodeLabel(code: string | null | undefined): string {
  if (!code) {
    return "–";
  }
  const words = code.toLowerCase().replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export function formatFactValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "–";
  }
  if (typeof value === "string" && ISO_TIMESTAMP_PATTERN.test(value)) {
    return formatDateTime(value);
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? "None" : value.join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export function secondsBetween(earlier_timestamp: string, later_epoch_ms: number): number {
  return Math.max(0, Math.floor((later_epoch_ms - new Date(earlier_timestamp).getTime()) / 1000));
}
