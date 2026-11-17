import { ACTION_CODES } from '../facts/constants/action_code.constant';

const ENHANCED_IDENTITY_LEVEL = 2;

// Card digits and the last transaction answer level 2 identity questions, so
// a caller confirmed only to level 1 never hears them back. Applies to the
// actions allowed at level 1 that return them; the stored result (staff view,
// audit) keeps everything.
const LEVEL_TWO_RESULT_KEYS: Record<string, string[] | undefined> = {
  [ACTION_CODES.LOCK_CARD]: ['card_last4', 'last_transaction'],
  [ACTION_CODES.REPORT_LOST_STOLEN]: ['card_last4', 'last_transaction'],
};

export function redactLevelOneResult(
  action_code: string,
  execution_result: Record<string, unknown> | null,
  identity_level: unknown,
): Record<string, unknown> | null {
  const level_two_keys = LEVEL_TWO_RESULT_KEYS[action_code];
  const is_enhanced =
    typeof identity_level === 'number' &&
    identity_level >= ENHANCED_IDENTITY_LEVEL;
  if (!execution_result || !level_two_keys || is_enhanced) {
    return execution_result;
  }
  return Object.fromEntries(
    Object.entries(execution_result).filter(
      ([result_key]) => !level_two_keys.includes(result_key),
    ),
  );
}
