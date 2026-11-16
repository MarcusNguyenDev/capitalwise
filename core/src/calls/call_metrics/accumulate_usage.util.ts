import { CallUsage } from '../types/call_metrics.type';

const USAGE_KEYS: (keyof CallUsage)[] = [
  'input_text_tokens',
  'input_audio_tokens',
  'cached_input_tokens',
  'output_text_tokens',
  'output_audio_tokens',
];

export function accumulateUsage(
  usage_so_far: Partial<CallUsage> | undefined,
  usage_increment: Partial<CallUsage>,
): CallUsage {
  const accumulated_usage = {} as CallUsage;
  for (const usage_key of USAGE_KEYS) {
    accumulated_usage[usage_key] =
      (usage_so_far?.[usage_key] ?? 0) + (usage_increment[usage_key] ?? 0);
  }
  return accumulated_usage;
}
