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
}

export interface TranscriptionResult {
  text: string;
  duration_seconds: number;
  provider: AiProviderName;
  model: string;
}
