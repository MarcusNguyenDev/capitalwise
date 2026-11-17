import { registerAs } from '@nestjs/config';

function readPositiveNumber(env_key: string, default_value: number): number {
  const parsed_value = Number((process.env[env_key] ?? '').trim());
  return Number.isFinite(parsed_value) && parsed_value > 0
    ? parsed_value
    : default_value;
}

// Limits on what one LIVE call may spend (they apply to every provider).
export const costGuardConfig = registerAs('cost_guard', () => ({
  // Estimated cost (metrics.estimated_cost_usd) at which the agent stops
  // generating, apologises and asks for a person.
  max_call_cost_usd: readPositiveNumber('AI_MAX_CALL_COST_USD', 1.0),
  // The agent ends the call after this long.
  max_live_call_minutes: readPositiveNumber('AI_MAX_LIVE_CALL_MINUTES', 15),
  // The agent says goodbye and ends the call after this much caller silence.
  idle_hangup_seconds: readPositiveNumber('AI_IDLE_HANGUP_SECONDS', 90),
}));
