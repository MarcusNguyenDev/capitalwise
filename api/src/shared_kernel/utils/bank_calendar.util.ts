// Dates the customer hears ("by Monday 23 November") are in the bank's own
// time zone and count business days (Monday to Friday; public holidays are
// not modelled in this prototype).

export const BANK_TIME_ZONE = 'Australia/Brisbane';

const SATURDAY = 6;
const SUNDAY = 0;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

// en-CA formats as YYYY-MM-DD.
const BANK_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: BANK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function parseIsoDate(iso_date: string): Date {
  const [year, month, day] = iso_date.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toIsoDate(utc_date: Date): string {
  return utc_date.toISOString().slice(0, 10);
}

export function getBankToday(now: Date = new Date()): string {
  return BANK_DATE_FORMATTER.format(now);
}

export function addCalendarDays(iso_date: string, day_count: number): string {
  return toIsoDate(
    new Date(
      parseIsoDate(iso_date).getTime() + day_count * MILLISECONDS_PER_DAY,
    ),
  );
}

export function addBusinessDays(
  iso_date: string,
  business_day_count: number,
): string {
  let current_date = parseIsoDate(iso_date);
  let remaining_days = business_day_count;
  while (remaining_days > 0) {
    current_date = new Date(current_date.getTime() + MILLISECONDS_PER_DAY);
    const weekday = current_date.getUTCDay();
    if (weekday !== SATURDAY && weekday !== SUNDAY) {
      remaining_days -= 1;
    }
  }
  return toIsoDate(current_date);
}

export function countDaysBetween(from_iso_date: string, to_iso_date: string) {
  return Math.round(
    (parseIsoDate(to_iso_date).getTime() -
      parseIsoDate(from_iso_date).getTime()) /
      MILLISECONDS_PER_DAY,
  );
}
