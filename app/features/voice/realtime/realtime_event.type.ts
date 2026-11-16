/** The parts of the Realtime API's server events that the phone relies on. */

export interface RealtimeUsage {
  input_token_details?: {
    text_tokens?: number;
    audio_tokens?: number;
    cached_tokens?: number;
    cached_tokens_details?: { text_tokens?: number; audio_tokens?: number };
  };
  output_token_details?: { text_tokens?: number; audio_tokens?: number };
}

export interface RealtimeOutputItem {
  type: string;
  call_id?: string;
  name?: string;
  arguments?: string;
}

export interface RealtimeServerEvent {
  type: string;
  item_id?: string;
  delta?: string;
  transcript?: string;
  session?: { audio?: { input?: { turn_detection?: Record<string, unknown> | null } } };
  response?: { usage?: RealtimeUsage; output?: RealtimeOutputItem[] };
  error?: { code?: string; message?: string };
}

export type RealtimeClientEvent = { type: string } & Record<string, unknown>;
