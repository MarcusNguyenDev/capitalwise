import { CallUsage } from '../types/call_metrics.type';

export interface TokenPrices {
  audio_input_usd_per_1m: number;
  audio_output_usd_per_1m: number;
  text_input_usd_per_1m: number;
  text_output_usd_per_1m: number;
  cached_input_usd_per_1m: number;
}

const TOKENS_PER_PRICE_UNIT = 1_000_000;
const COST_DECIMAL_PLACES = 4;

// `input_text_tokens` and `input_audio_tokens` are the NON-cached tokens;
// cached input (text or audio) is billed at the single cached rate.
export function calculateEstimatedCostUsd(
  usage: Partial<CallUsage>,
  token_prices: TokenPrices,
): number {
  const price_weighted_tokens =
    (usage.input_text_tokens ?? 0) * token_prices.text_input_usd_per_1m +
    (usage.input_audio_tokens ?? 0) * token_prices.audio_input_usd_per_1m +
    (usage.cached_input_tokens ?? 0) * token_prices.cached_input_usd_per_1m +
    (usage.output_text_tokens ?? 0) * token_prices.text_output_usd_per_1m +
    (usage.output_audio_tokens ?? 0) * token_prices.audio_output_usd_per_1m;
  const rounding_factor = 10 ** COST_DECIMAL_PLACES;
  return (
    Math.round(
      (price_weighted_tokens / TOKENS_PER_PRICE_UNIT) * rounding_factor,
    ) / rounding_factor
  );
}
