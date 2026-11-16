import { registerAs } from '@nestjs/config';

import { AiProviderName } from '../ai/types/ai_provider_name.type';

function readText(env_key: string, default_value = ''): string {
  return (process.env[env_key] ?? default_value).trim();
}

function readNumber(env_key: string, default_value: number): number {
  const raw_value = readText(env_key);
  const parsed_value = Number(raw_value);
  return raw_value === '' || Number.isNaN(parsed_value)
    ? default_value
    : parsed_value;
}

function readBaseUrl(env_key: string, default_value = ''): string {
  return readText(env_key, default_value).replace(/\/+$/, '');
}

function readProviderName(
  env_key: string,
  default_value: AiProviderName,
): string {
  return readText(env_key, default_value).toLowerCase();
}

// Which provider serves each capability, the models, and how to reach every
// provider. Only the providers in use need a base URL.
export const aiConfig = registerAs('ai', () => ({
  chat: {
    provider: readProviderName('AI_CHAT_PROVIDER', 'ollama'),
    model: readText('AI_CHAT_MODEL', 'gpt-6:luna'),
    temperature: readNumber('AI_CHAT_TEMPERATURE', 0.4),
    max_output_tokens: readNumber('AI_CHAT_MAX_OUTPUT_TOKENS', 300),
    timeout_ms: readNumber('AI_CHAT_TIMEOUT_MS', 30_000),
    reasoning_effort: readText('AI_CHAT_REASONING_EFFORT', 'none'),
  },
  transcribe: {
    provider: readProviderName('AI_STT_PROVIDER', 'speaches'),
    model: readText('AI_STT_MODEL', 'Systran/faster-whisper-small.en'),
    language: readText('AI_STT_LANGUAGE', 'en'),
    timeout_ms: readNumber('AI_STT_TIMEOUT_MS', 20_000),
  },
  synthesize: {
    provider: readProviderName('AI_TTS_PROVIDER', 'speaches'),
    model: readText('AI_TTS_MODEL', 'speaches-ai/Kokoro-82M-v1.0-ONNX'),
    ai_voice: readText('AI_TTS_AI_VOICE', 'bf_emma'),
    staff_voice: readText('AI_TTS_STAFF_VOICE', 'bm_george'),
    speed: readNumber('AI_TTS_SPEED', 1.0),
    timeout_ms: readNumber('AI_TTS_TIMEOUT_MS', 20_000),
  },
  health_check_timeout_ms: readNumber('AI_HEALTH_CHECK_TIMEOUT_MS', 2_000),
  providers: {
    ollama: {
      base_url: readBaseUrl('OLLAMA_BASE_URL'),
      api_key: readText('OLLAMA_API_KEY'),
    },
    vllm: {
      base_url: readBaseUrl('VLLM_BASE_URL'),
      api_key: readText('VLLM_API_KEY'),
    },
    openai: {
      base_url: readBaseUrl('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
      api_key: readText('OPENAI_API_KEY'),
    },
    speaches: {
      base_url: readBaseUrl('SPEACHES_BASE_URL', 'http://localhost:8000/v1'),
      api_key: readText('SPEACHES_API_KEY'),
    },
  },
}));

export type AiConfig = ReturnType<typeof aiConfig>;
