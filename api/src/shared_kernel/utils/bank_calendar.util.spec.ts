import {
  addBusinessDays,
  addCalendarDays,
  countDaysBetween,
  getBankToday,
} from './bank_calendar.util';
import { formatSpokenDate } from './format_spoken_date.util';

describe('bank calendar', () => {
  it('skips weekends when adding business days', () => {
    // Tuesday 17 November 2026 + 5 business days = Tuesday 24 November.
    expect(addBusinessDays('2026-11-17', 5)).toBe('2026-11-24');
    // Friday + 1 business day = Monday.
    expect(addBusinessDays('2026-11-20', 1)).toBe('2026-11-23');
    // Saturday + 1 business day = Monday.
    expect(addBusinessDays('2026-11-21', 1)).toBe('2026-11-23');
  });

  it('adds calendar days across a month end', () => {
    expect(addCalendarDays('2026-11-28', 7)).toBe('2026-12-05');
    expect(countDaysBetween('2026-11-17', '2026-12-15')).toBe(28);
  });

  it("reads today's date in Brisbane, not UTC", () => {
    // 20:30 UTC on 16 November is 06:30 on 17 November in Brisbane.
    expect(getBankToday(new Date('2026-11-16T20:30:00Z'))).toBe('2026-11-17');
  });

  it('formats a date the way it is said on the phone', () => {
    expect(formatSpokenDate('2026-11-23')).toBe('Monday 23 November');
    expect(formatSpokenDate('2026-12-15T00:00:00.000Z')).toBe(
      'Tuesday 15 December',
    );
  });
});
