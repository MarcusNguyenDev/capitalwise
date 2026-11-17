export interface CallUsage {
  // llm_input_tokens excludes the cached ones.
  llm_input_tokens: number;
  llm_cached_input_tokens: number;
  llm_output_tokens: number;
  stt_audio_seconds: number;
  // Speech billed per character (dedicated TTS models, self-hosted).
  tts_characters: number;
  // Speech billed per token (an OpenAI Realtime model used as a reader);
  // tts_input_tokens excludes the cached ones.
  tts_input_tokens: number;
  tts_cached_input_tokens: number;
  tts_output_audio_tokens: number;
  tts_output_text_tokens: number;
}

export type CallHoldReason = 'CHECKING_SYSTEM' | 'WAITING_FOR_APP_APPROVAL';

// The latest hold, so a page loaded mid-hold can show it.
export interface CallHoldState {
  is_on_hold: boolean;
  reason: CallHoldReason;
  tool_name: string;
  started_at: string;
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
  hold?: CallHoldState | null;
  total_hold_ms?: number;
  // Lines where the realtime voice did not say what it was asked to.
  tts_drift_count?: number;
}
