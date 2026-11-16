import { registerAs } from '@nestjs/config';

export const pricingConfig = registerAs('pricing', () => ({
  audio_input_usd_per_1m: Number(
    process.env.PRICE_PER_1M_AUDIO_INPUT_USD ?? 32,
  ),
  audio_output_usd_per_1m: Number(
    process.env.PRICE_PER_1M_AUDIO_OUTPUT_USD ?? 64,
  ),
  text_input_usd_per_1m: Number(process.env.PRICE_PER_1M_TEXT_INPUT_USD ?? 4),
  text_output_usd_per_1m: Number(
    process.env.PRICE_PER_1M_TEXT_OUTPUT_USD ?? 16,
  ),
  cached_input_usd_per_1m: Number(
    process.env.PRICE_PER_1M_CACHED_INPUT_USD ?? 0.4,
  ),
}));
