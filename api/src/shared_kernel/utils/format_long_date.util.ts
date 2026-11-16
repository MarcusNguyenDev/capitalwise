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

// Takes a plain `YYYY-MM-DD` date (or an ISO timestamp) and returns
// "7 December 2026" without any time zone conversion.
export function formatLongDate(iso_date: string): string {
  const [year, month, day] = iso_date.slice(0, 10).split('-').map(Number);
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}
