import { registerAs } from '@nestjs/config';

export const voiceConfig = registerAs('voice', () => ({
  // Optional: without a key the service runs in Scripted mode only.
  openai_api_key: (process.env.OPENAI_API_KEY ?? '').trim(),
  openai_base_url: (
    process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
  ).replace(/\/+$/, ''),
  realtime_model: process.env.OPENAI_REALTIME_MODEL ?? 'gpt-realtime',
  realtime_voice: process.env.OPENAI_REALTIME_VOICE ?? 'marin',
  transcription_model:
    process.env.OPENAI_TRANSCRIPTION_MODEL ?? 'gpt-4o-mini-transcribe',
}));
