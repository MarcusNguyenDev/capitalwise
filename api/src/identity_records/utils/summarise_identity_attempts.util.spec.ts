import { IdentityAttempt } from '../types/identity_attempt.type';
import {
  countRemainingAttempts,
  summariseIdentityAttempts,
} from './summarise_identity_attempts.util';

type Outcome = Pick<
  IdentityAttempt,
  'level' | 'is_passed' | 'resolved_customer_id' | 'method'
>;

function passed(level: 1 | 2, customer_id: string): Outcome {
  return {
    level,
    is_passed: true,
    resolved_customer_id: customer_id,
    method: 'KNOWLEDGE',
  };
}

function failed(level: 1 | 2): Outcome {
  return {
    level,
    is_passed: false,
    resolved_customer_id: null,
    method: 'KNOWLEDGE',
  };
}

describe('summariseIdentityAttempts (lockout and step-up)', () => {
  it('starts unverified with two attempts per level', () => {
    const summary = summariseIdentityAttempts([]);
    expect(summary).toMatchObject({
      identity_level: 0,
      method: null,
      is_locked: false,
      failed_attempts: 0,
      customer_id: null,
    });
    expect(countRemainingAttempts(summary, 1)).toBe(2);
  });

  it('steps up from level 1 to level 2 for the same customer', () => {
    expect(summariseIdentityAttempts([passed(1, 'CUS-1001')])).toMatchObject({
      identity_level: 1,
      customer_id: 'CUS-1001',
    });
    expect(
      summariseIdentityAttempts([passed(1, 'CUS-1001'), passed(2, 'CUS-1001')]),
    ).toMatchObject({
      identity_level: 2,
      method: 'KNOWLEDGE',
      customer_id: 'CUS-1001',
    });
  });

  it('one failure leaves one attempt; the second failure locks the call', () => {
    const one_failure = summariseIdentityAttempts([failed(1)]);
    expect(one_failure).toMatchObject({ is_locked: false, failed_attempts: 1 });
    expect(countRemainingAttempts(one_failure, 1)).toBe(1);

    const locked = summariseIdentityAttempts([failed(1), failed(1)]);
    expect(locked).toMatchObject({
      identity_level: 0,
      is_locked: true,
      failed_attempts: 2,
      customer_id: null,
    });
    expect(countRemainingAttempts(locked, 1)).toBe(0);
    expect(countRemainingAttempts(locked, 2)).toBe(0);
  });

  it('counts failures per level, so one at each level does not lock', () => {
    const summary = summariseIdentityAttempts([
      failed(1),
      passed(1, 'CUS-1001'),
      failed(2),
    ]);
    expect(summary).toMatchObject({
      identity_level: 1,
      is_locked: false,
      failed_attempts: 2,
    });
    expect(countRemainingAttempts(summary, 2)).toBe(1);
  });

  it('two failures at level 2 lock even a caller who passed level 1', () => {
    expect(
      summariseIdentityAttempts([passed(1, 'CUS-1001'), failed(2), failed(2)]),
    ).toMatchObject({ identity_level: 0, is_locked: true, customer_id: null });
  });

  it('follows the latest passed customer, whose level starts again', () => {
    const summary = summariseIdentityAttempts([
      passed(1, 'CUS-1005'),
      passed(2, 'CUS-1005'),
      passed(1, 'CUS-1006'),
    ]);
    expect(summary).toMatchObject({
      identity_level: 1,
      customer_id: 'CUS-1006',
    });
  });

  it('an approved app push is level 1 with method APP_PUSH', () => {
    expect(
      summariseIdentityAttempts([
        { ...passed(1, 'CUS-1001'), method: 'APP_PUSH' },
      ]),
    ).toMatchObject({ identity_level: 1, method: 'APP_PUSH' });
  });
});
