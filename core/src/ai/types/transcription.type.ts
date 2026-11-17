import { AiProviderName } from './ai_provider_name.type';

export interface TranscriptionRequest {
  // A WAV file.
  audio: Buffer;
  model?: string;
  language?: string;
  prompt?: string;
  abort_signal?: AbortSignal;
}

export interface ResolvedTranscriptionRequest extends TranscriptionRequest {
  model: string;
  timeout_ms: number;
  // AI_STT_BASE_URL: this capability's own server (empty = the provider's).
  base_url?: string;
}

export interface TranscriptionResult {
  text: string;
  duration_seconds: number;
  provider: AiProviderName;
  model: string;
}
