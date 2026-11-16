import { CallUsage } from '../types/call_metrics.type';

const USAGE_KEYS: (keyof CallUsage)[] = [
  'llm_input_tokens',
  'llm_output_tokens',
  'stt_audio_seconds',
  'tts_characters',
];

const STT_SECONDS_DECIMAL_PLACES = 2;

export function accumulateUsage(
  usage_so_far: Partial<CallUsage> | undefined,
  usage_increment: Partial<CallUsage>,
): CallUsage {
  const accumulated_usage = {} as CallUsage;
  for (const usage_key of USAGE_KEYS) {
    accumulated_usage[usage_key] =
      (usage_so_far?.[usage_key] ?? 0) + (usage_increment[usage_key] ?? 0);
  }
  const rounding_factor = 10 ** STT_SECONDS_DECIMAL_PLACES;
  accumulated_usage.stt_audio_seconds =
    Math.round(accumulated_usage.stt_audio_seconds * rounding_factor) /
    rounding_factor;
  return accumulated_usage;
}
