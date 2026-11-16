import { registerAs } from '@nestjs/config';

// What the caller hears while the AI checks the system.
export const holdBufferConfig = registerAs('hold_buffer', () => ({
  reminder_interval_ms: Number(process.env.HOLD_REMINDER_INTERVAL_MS ?? 8_000),
  return_threshold_ms: Number(process.env.HOLD_RETURN_THRESHOLD_MS ?? 2_500),
  is_tone_enabled:
    (process.env.HOLD_TONE_ENABLED ?? 'true').trim().toLowerCase() !== 'false',
}));

export type HoldBufferConfig = ReturnType<typeof holdBufferConfig>;
