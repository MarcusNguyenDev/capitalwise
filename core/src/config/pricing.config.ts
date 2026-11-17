import { registerAs } from '@nestjs/config';

function readPrice(env_key: string, default_usd: number): number {
  const raw_value = (process.env[env_key] ?? '').trim();
  return raw_value === '' || Number.isNaN(Number(raw_value))
    ? default_usd
    : Number(raw_value);
}

// Defaults are the owner's OpenAI setup (from the model pages): gpt-6-luna
// for chat, gpt-live-transcribe for speech-to-text, gpt-realtime-2.1-mini
// as the voice. Set them to 0 for self-hosted models.
export const pricingConfig = registerAs('pricing', () => ({
  llm_input_usd_per_1m_tokens: readPrice(
    'PRICE_PER_1M_LLM_INPUT_TOKENS_USD',
    0.1,
  ),
  llm_cached_input_usd_per_1m_tokens: readPrice(
    'PRICE_PER_1M_LLM_CACHED_INPUT_TOKENS_USD',
    0.01,
  ),
  llm_output_usd_per_1m_tokens: readPrice(
    'PRICE_PER_1M_LLM_OUTPUT_TOKENS_USD',
    0.5,
  ),
  stt_usd_per_minute: readPrice('PRICE_PER_MINUTE_STT_USD', 0.017),
  tts_usd_per_1m_characters: readPrice('PRICE_PER_1M_TTS_CHARACTERS_USD', 0),
  tts_input_usd_per_1m_tokens: readPrice(
    'PRICE_PER_1M_TTS_TEXT_INPUT_TOKENS_USD',
    0.6,
  ),
  tts_cached_input_usd_per_1m_tokens: readPrice(
    'PRICE_PER_1M_TTS_CACHED_INPUT_TOKENS_USD',
    0.06,
  ),
  tts_output_audio_usd_per_1m_tokens: readPrice(
    'PRICE_PER_1M_TTS_AUDIO_OUTPUT_TOKENS_USD',
    20,
  ),
  tts_output_text_usd_per_1m_tokens: readPrice(
    'PRICE_PER_1M_TTS_TEXT_OUTPUT_TOKENS_USD',
    2.4,
  ),
}));
