import { describeCallDate } from './describe_call_date.util';

describe('describeCallDate', () => {
  it('states the date and time in the bank time zone', () => {
    // 21:12 UTC on 16 November is 7:12 am on 17 November in Brisbane.
    const call_date = describeCallDate(
      new Date('2026-11-16T21:12:00Z'),
      'Australia/Brisbane',
    );

    expect(call_date).toContain('Tuesday 17 November 2026');
    expect(call_date).toMatch(/7:12\s?am/i);
    expect(call_date).toContain('Australia/Brisbane');
  });
});
