import {
  IDENTITY_LEVELS,
  MAX_FAILED_ATTEMPTS_PER_LEVEL,
} from '../constants/identity_level.constant';
import {
  CheckLevel,
  IdentityAttempt,
  IdentityLevel,
  IdentitySummary,
} from '../types/identity_attempt.type';

type AttemptOutcome = Pick<
  IdentityAttempt,
  'level' | 'is_passed' | 'resolved_customer_id' | 'method'
>;

function countFailures(attempts: AttemptOutcome[], level: CheckLevel): number {
  return attempts.filter(
    (attempt) => !attempt.is_passed && attempt.level === level,
  ).length;
}

// Pure: attempts in the order they were made -> the call's identity state.
// The caller is whoever the LATEST passed attempt resolved to; their level is
// the highest level they have passed on this call. Two failures at one level
// lock the call (level 0) whatever was passed before.
export function summariseIdentityAttempts(
  attempts: AttemptOutcome[],
): IdentitySummary {
  const failed_attempts_by_level: Record<CheckLevel, number> = {
    1: countFailures(attempts, 1),
    2: countFailures(attempts, 2),
  };
  const is_locked = Object.values(failed_attempts_by_level).some(
    (failure_count) => failure_count >= MAX_FAILED_ATTEMPTS_PER_LEVEL,
  );
  const passed_attempts = attempts.filter((attempt) => attempt.is_passed);
  const latest_pass = passed_attempts[passed_attempts.length - 1] ?? null;
  const verified_customer_id = latest_pass?.resolved_customer_id ?? null;
  const verified_level = passed_attempts
    .filter((attempt) => attempt.resolved_customer_id === verified_customer_id)
    .reduce<number>(
      (highest_level, attempt) => Math.max(highest_level, attempt.level),
      IDENTITY_LEVELS.NONE,
    ) as IdentityLevel;
  return {
    identity_level: is_locked ? IDENTITY_LEVELS.NONE : verified_level,
    method: latest_pass?.method ?? null,
    is_locked,
    failed_attempts: failed_attempts_by_level[1] + failed_attempts_by_level[2],
    failed_attempts_by_level,
    customer_id: is_locked ? null : verified_customer_id,
  };
}

export function countRemainingAttempts(
  summary: IdentitySummary,
  level: CheckLevel,
): number {
  if (summary.is_locked) {
    return 0;
  }
  return Math.max(
    MAX_FAILED_ATTEMPTS_PER_LEVEL - summary.failed_attempts_by_level[level],
    0,
  );
}
