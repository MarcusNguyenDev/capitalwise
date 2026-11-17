import { AiProviderName } from './ai_provider_name.type';

export interface SpeechRequest {
  text: string;
  model?: string;
  voice?: string;
  speed?: number;
  // Natural-language tone guidance, for providers that accept it
  // (Qwen3-TTS on vLLM-Omni, OpenAI gpt-4o-mini-tts).
  instructions?: string;
  // The rate the caller wants back; providers resample when needed.
  sample_rate?: number;
  // A live call's id: connection-based voices (OpenAI Realtime) keep their
  // sessions for that call and close them on releaseSpeechSessions(). Without
  // it a session is opened for the one request and closed after it.
  session_key?: string;
  abort_signal?: AbortSignal;
}

export interface ResolvedSpeechRequest extends SpeechRequest {
  model: string;
  voice: string;
  speed: number;
  timeout_ms: number;
  // AI_TTS_BASE_URL: this capability's own server (empty = the provider's).
  base_url?: string;
}

// Raw 16-bit mono PCM.
export interface SpeechResult {
  pcm: Int16Array;
  sample_rate: number;
  provider: AiProviderName;
  model: string;
  voice: string;
}
