import { AiProviderName } from './ai_provider_name.type';

export interface SpeechRequest {
  text: string;
  model?: string;
  voice?: string;
  speed?: number;
  // The rate the caller wants back; providers resample when needed.
  sample_rate?: number;
  abort_signal?: AbortSignal;
}

export interface ResolvedSpeechRequest extends SpeechRequest {
  model: string;
  voice: string;
  speed: number;
  timeout_ms: number;
}

// Raw 16-bit mono PCM.
export interface SpeechResult {
  pcm: Int16Array;
  sample_rate: number;
  provider: AiProviderName;
  model: string;
  voice: string;
}
