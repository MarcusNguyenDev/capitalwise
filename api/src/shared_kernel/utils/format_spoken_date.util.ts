const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// "2026-11-23" -> "Monday 23 November": how a person would say it on the
// phone. No time zone conversion; the date is taken as written.
export function formatSpokenDate(iso_date: string): string {
  const [year, month, day] = iso_date.slice(0, 10).split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${WEEKDAY_NAMES[weekday]} ${day} ${MONTH_NAMES[month - 1]}`;
}
