import { registerAs } from '@nestjs/config';

// Every price defaults to 0: the speech and language models are self-hosted.
export const pricingConfig = registerAs('pricing', () => ({
  llm_input_usd_per_1m_tokens: Number(
    process.env.PRICE_PER_1M_LLM_INPUT_TOKENS_USD ?? 0,
  ),
  llm_output_usd_per_1m_tokens: Number(
    process.env.PRICE_PER_1M_LLM_OUTPUT_TOKENS_USD ?? 0,
  ),
  stt_usd_per_minute: Number(process.env.PRICE_PER_MINUTE_STT_USD ?? 0),
  tts_usd_per_1m_characters: Number(
    process.env.PRICE_PER_1M_TTS_CHARACTERS_USD ?? 0,
  ),
}));
