export interface CallUsage {
  input_text_tokens: number;
  input_audio_tokens: number;
  cached_input_tokens: number;
  output_text_tokens: number;
  output_audio_tokens: number;
}

export type CallMode = 'LIVE' | 'SCRIPTED';

export interface CallMetrics {
  mode?: CallMode;
  response_times_ms?: number[];
  avg_response_ms?: number | null;
  time_to_identity_ms?: number | null;
  time_to_resolution_ms?: number | null;
  time_to_human_ms?: number | null;
  human_requested_at?: string | null;
  usage?: Partial<CallUsage>;
  estimated_cost_usd?: number;
}
