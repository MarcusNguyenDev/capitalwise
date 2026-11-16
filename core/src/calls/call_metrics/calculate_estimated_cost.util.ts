import { CallUsage } from '../types/call_metrics.type';

export interface UsagePrices {
  llm_input_usd_per_1m_tokens: number;
  llm_output_usd_per_1m_tokens: number;
  stt_usd_per_minute: number;
  tts_usd_per_1m_characters: number;
}

const UNITS_PER_MILLION = 1_000_000;
const SECONDS_PER_MINUTE = 60;
const COST_DECIMAL_PLACES = 4;

// All prices default to 0 because every model is self-hosted; set them in
// core/.env to estimate the cost of a hosted provider.
export function calculateEstimatedCostUsd(
  usage: Partial<CallUsage>,
  usage_prices: UsagePrices,
): number {
  const estimated_cost_usd =
    ((usage.llm_input_tokens ?? 0) * usage_prices.llm_input_usd_per_1m_tokens +
      (usage.llm_output_tokens ?? 0) *
        usage_prices.llm_output_usd_per_1m_tokens +
      (usage.tts_characters ?? 0) * usage_prices.tts_usd_per_1m_characters) /
      UNITS_PER_MILLION +
    ((usage.stt_audio_seconds ?? 0) / SECONDS_PER_MINUTE) *
      usage_prices.stt_usd_per_minute;
  const rounding_factor = 10 ** COST_DECIMAL_PLACES;
  return Math.round(estimated_cost_usd * rounding_factor) / rounding_factor;
}
