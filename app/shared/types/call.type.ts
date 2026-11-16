export type CallStatus = "AI_ACTIVE" | "NEEDS_ATTENTION" | "HUMAN_ACTIVE" | "ENDED";
export type CallChannel = "BROWSER" | "PHONE" | "SIMULATED";
export type CallMode = "LIVE" | "SCRIPTED";
export type Sentiment = "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "DISTRESSED";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type TurnSpeaker = "CUSTOMER" | "AI" | "STAFF" | "SYSTEM";
export type InterventionType = "MONITOR" | "INSTRUCTION" | "TAKEOVER" | "HANDBACK" | "END_CALL";
export type CallCommandType = "INSTRUCTION" | "TAKEOVER" | "HANDBACK" | "END_CALL" | "STAFF_MESSAGE";

export interface TokenUsage {
  input_text_tokens?: number;
  input_audio_tokens?: number;
  cached_input_tokens?: number;
  output_text_tokens?: number;
  output_audio_tokens?: number;
}

export interface CallMetrics {
  mode?: CallMode;
  response_times_ms?: number[];
  avg_response_ms?: number | null;
  time_to_identity_ms?: number | null;
  time_to_resolution_ms?: number | null;
  time_to_human_ms?: number | null;
  usage?: TokenUsage;
  estimated_cost_usd?: number | null;
}

export interface LiveCall {
  call_id: string;
  caller_number: string;
  customer_id: string | null;
  customer_name: string | null;
  channel: CallChannel;
  status: CallStatus;
  handled_by_agent_id: string | null;
  agent_name: string | null;
  assigned_staff_id: string | null;
  assigned_staff_name: string | null;
  identity_verified: boolean;
  verified_at: string | null;
  intent: string | null;
  sentiment: Sentiment;
  risk_level: RiskLevel;
  attention_reason: string | null;
  started_at: string;
  ended_at: string | null;
  ai_summary: string | null;
  metrics: CallMetrics;
  last_line: string | null;
  last_speaker: TurnSpeaker | null;
  duration_seconds: number;
}

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
  created_at: string;
}

export interface Intervention {
  intervention_id: string;
  call_id: string;
  staff_id: string;
  staff_name: string;
  type: InterventionType;
  text: string | null;
  created_at: string;
}

export interface CallDetail {
  call: LiveCall;
  turns: CallTurn[];
  interventions: Intervention[];
}

export interface TranscriptDelta {
  call_id: string;
  speaker: "CUSTOMER" | "AI";
  delta: string;
  item_id: string;
}

export interface CallCommand {
  call_id: string;
  command: CallCommandType;
  text: string | null;
  staff_id: string;
  staff_name: string;
  intervention_id: string | null;
}

export interface WebrtcSignal {
  call_id: string;
  sender: "STAFF" | "PHONE";
  payload: Record<string, unknown>;
}

export type ToolCallResponse =
  | { ok: true; result: Record<string, unknown> }
  | { ok: false; error: { code: string; message: string } };

export interface VoiceStatus {
  is_live_available: boolean;
  model: string;
  voice: string;
}

export interface VoiceSession {
  client_secret: string;
  expires_at: number | string;
  model: string;
  voice: string;
  instructions: string;
  tools: Record<string, unknown>[];
}

export type ScriptStep =
  | { type: "ai"; text: string }
  | { type: "customer"; text: string }
  | { type: "tool"; tool_name: string; args: Record<string, unknown> }
  | { type: "insight"; intent?: string; sentiment?: Sentiment; summary?: string }
  | { type: "await_instruction"; timeout_seconds: number; ai_with_instruction: string; ai_without_instruction: string }
  | { type: "await_takeover"; timeout_seconds: number; ai_if_timeout?: string }
  | { type: "pause"; seconds: number };

export interface CallScript {
  script_id: string;
  title: string;
  customer_id: string;
  caller_number: string;
  steps: ScriptStep[];
}

export interface CallScriptSummary {
  script_id: string;
  title: string;
  customer_id: string;
  caller_number?: string;
}

export interface SimulatorStatus {
  is_running: boolean;
  speed: 1 | 2;
  active_call_count: number;
  scripts: CallScriptSummary[];
}
