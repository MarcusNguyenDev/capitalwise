import { localizeTimestamps } from './localize_timestamps.util';

describe('localizeTimestamps', () => {
  it('rewrites nested UTC timestamps into the bank time zone and dates into words', () => {
    const tool_result = {
      ok: true,
      result: {
        transactions: [
          {
            txn_id: 'TXN-1',
            created_at: '2026-11-16T02:14:00.000Z',
            amount: -264,
          },
        ],
        next_repayment_due: '2026-11-27',
        merchant: 'Northshore Electronics',
      },
    };

    const localized = localizeTimestamps(
      tool_result,
      'Australia/Brisbane',
    ) as typeof tool_result;

    expect(localized.result.transactions[0].created_at).toMatch(
      /Monday 16 November 2026.*12:14\s?pm/i,
    );
    expect(localized.result.next_repayment_due).toBe('Friday 27 November 2026');
    expect(localized.result.transactions[0].amount).toBe(-264);
    expect(localized.result.merchant).toBe('Northshore Electronics');
    expect(localized.ok).toBe(true);
  });

  it('crosses midnight correctly: 21:30 UTC is the next morning in Brisbane', () => {
    expect(
      localizeTimestamps('2026-11-16T21:30:00Z', 'Australia/Brisbane'),
    ).toMatch(/Tuesday 17 November 2026.*7:30\s?am/i);
  });
});
