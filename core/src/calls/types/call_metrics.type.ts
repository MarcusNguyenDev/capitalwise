export interface CallUsage {
  llm_input_tokens: number;
  llm_output_tokens: number;
  stt_audio_seconds: number;
  tts_characters: number;
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
}
