import { AiProviderName } from './ai_provider_name.type';

// Token usage of a speech request billed per token (OpenAI Realtime).
export interface SpeechUsage {
  input_text_tokens: number;
  cached_input_tokens: number;
  output_audio_tokens: number;
  output_text_tokens: number;
}

export interface SpeechSummary {
  provider: AiProviderName;
  model: string;
  voice: string;
  requested_text: string;
  // What the voice model says it said (realtime models only), else null.
  spoken_transcript: string | null;
  // The spoken transcript differs from the requested text beyond the
  // tolerance: a realtime "reader" model changed the words.
  is_drifted: boolean;
  usage: SpeechUsage | null;
}

// PCM chunks (16-bit mono, at the requested rate) as they are produced, and
// a summary once the stream has ended.
export interface SpeechStream extends AsyncIterable<Int16Array> {
  readonly summary: Promise<SpeechSummary>;
}
