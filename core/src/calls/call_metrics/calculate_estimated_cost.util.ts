import { CallUsage } from '../types/call_metrics.type';

export interface UsagePrices {
  llm_input_usd_per_1m_tokens: number;
  llm_cached_input_usd_per_1m_tokens: number;
  llm_output_usd_per_1m_tokens: number;
  stt_usd_per_minute: number;
  tts_usd_per_1m_characters: number;
  tts_input_usd_per_1m_tokens: number;
  tts_cached_input_usd_per_1m_tokens: number;
  tts_output_audio_usd_per_1m_tokens: number;
  tts_output_text_usd_per_1m_tokens: number;
}

const UNITS_PER_MILLION = 1_000_000;
const SECONDS_PER_MINUTE = 60;
const COST_DECIMAL_PLACES = 4;

const PER_MILLION_PRICES: [keyof CallUsage, keyof UsagePrices][] = [
  ['llm_input_tokens', 'llm_input_usd_per_1m_tokens'],
  ['llm_cached_input_tokens', 'llm_cached_input_usd_per_1m_tokens'],
  ['llm_output_tokens', 'llm_output_usd_per_1m_tokens'],
  ['tts_characters', 'tts_usd_per_1m_characters'],
  ['tts_input_tokens', 'tts_input_usd_per_1m_tokens'],
  ['tts_cached_input_tokens', 'tts_cached_input_usd_per_1m_tokens'],
  ['tts_output_audio_tokens', 'tts_output_audio_usd_per_1m_tokens'],
  ['tts_output_text_tokens', 'tts_output_text_usd_per_1m_tokens'],
];

// Prices come from core/.env (PRICE_*): set them to 0 for self-hosted models.
export function calculateEstimatedCostUsd(
  usage: Partial<CallUsage>,
  usage_prices: UsagePrices,
): number {
  const per_million_cost = PER_MILLION_PRICES.reduce(
    (cost_total, [usage_key, price_key]) =>
      cost_total + (usage[usage_key] ?? 0) * usage_prices[price_key],
    0,
  );
  const estimated_cost_usd =
    per_million_cost / UNITS_PER_MILLION +
    ((usage.stt_audio_seconds ?? 0) / SECONDS_PER_MINUTE) *
      usage_prices.stt_usd_per_minute;
  const rounding_factor = 10 ** COST_DECIMAL_PLACES;
  return Math.round(estimated_cost_usd * rounding_factor) / rounding_factor;
}
