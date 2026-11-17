const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function formatLocalTimestamp(timestamp: string, time_zone: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: time_zone,
  }).format(new Date(timestamp));
}

// A calendar date has no time zone, so it is formatted as written.
function formatCalendarDate(calendar_date: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${calendar_date}T00:00:00Z`));
}

/**
 * The model reads tool results literally: given "2026-11-16T02:14:00Z" it
 * says "two fourteen" for a purchase made at 12:14 pm in Brisbane. This
 * rewrites every timestamp in the MODEL'S copy of a tool result into the
 * bank's local time; the stored transcript and audit keep the exact UTC value.
 */
export function localizeTimestamps(value: unknown, time_zone: string): unknown {
  if (typeof value === 'string') {
    if (ISO_TIMESTAMP_PATTERN.test(value)) {
      return formatLocalTimestamp(value, time_zone);
    }
    return CALENDAR_DATE_PATTERN.test(value)
      ? formatCalendarDate(value)
      : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => localizeTimestamps(item, time_zone));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        localizeTimestamps(entry, time_zone),
      ]),
    );
  }
  return value;
}
