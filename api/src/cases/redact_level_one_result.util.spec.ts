import { buildCompletedMessage } from './completed_action_messages';
import { redactLevelOneResult } from './redact_level_one_result.util';

const LOCK_RESULT = {
  card_id: 'CRD-10011',
  card_type: 'DEBIT',
  card_last4: '4821',
  previous_status: 'ACTIVE',
  card_status: 'TEMP_LOCKED',
  last_transaction: { merchant: 'Pulse Gym Cafe', amount: 8.5 },
};

describe('redactLevelOneResult', () => {
  it('withholds card digits and the last transaction at level 1', () => {
    expect(redactLevelOneResult('LOCK_CARD', LOCK_RESULT, 1)).toEqual({
      card_id: 'CRD-10011',
      card_type: 'DEBIT',
      previous_status: 'ACTIVE',
      card_status: 'TEMP_LOCKED',
    });
    expect(
      redactLevelOneResult('REPORT_LOST_STOLEN', LOCK_RESULT, undefined),
    ).not.toHaveProperty('card_last4');
  });

  it('keeps everything at level 2, and for actions that need level 2', () => {
    expect(redactLevelOneResult('LOCK_CARD', LOCK_RESULT, 2)).toBe(LOCK_RESULT);
    expect(redactLevelOneResult('UNLOCK_CARD', LOCK_RESULT, 1)).toBe(
      LOCK_RESULT,
    );
    expect(redactLevelOneResult('LOCK_CARD', null, 1)).toBeNull();
  });

  it('says "your debit card" when the digits were withheld', () => {
    const redacted = redactLevelOneResult(
      'REPORT_LOST_STOLEN',
      LOCK_RESULT,
      1,
    ) as Record<string, unknown>;
    expect(buildCompletedMessage('REPORT_LOST_STOLEN', redacted)).toBe(
      "I've blocked your debit card for good, so nobody can use it, and I can order you a replacement whenever you're ready.",
    );
    expect(buildCompletedMessage('LOCK_CARD', LOCK_RESULT)).toContain(
      'Your card ending 4821 is now temporarily locked',
    );
  });
});
