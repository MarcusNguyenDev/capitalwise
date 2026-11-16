export type TurnSpeaker = 'CUSTOMER' | 'AI' | 'STAFF' | 'SYSTEM';

// Row of engine.call_turns.
export interface CallTurn {
  turn_id: number;
  call_id: string;
  seq: number;
  speaker: TurnSpeaker;
  text: string | null;
  tool_name: string | null;
  tool_args: Record<string, unknown> | null;
  tool_result: Record<string, unknown> | null;
  latency_ms: number | null;
  created_at: Date;
}

export interface NewCallTurn {
  call_id: string;
  speaker: TurnSpeaker;
  text?: string | null;
  tool_name?: string | null;
  tool_args?: Record<string, unknown> | null;
  tool_result?: Record<string, unknown> | null;
  latency_ms?: number | null;
}
