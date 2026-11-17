export type CallStatus = "AI_ACTIVE" | "NEEDS_ATTENTION" | "HUMAN_ACTIVE" | "ENDED";
export type CallChannel = "BROWSER" | "PHONE" | "SIMULATED";
export type CallMode = "LIVE" | "SCRIPTED";
export type Sentiment = "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "DISTRESSED";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type TurnSpeaker = "CUSTOMER" | "AI" | "STAFF" | "SYSTEM";
export type InterventionType = "MONITOR" | "INSTRUCTION" | "TAKEOVER" | "HANDBACK" | "END_CALL";
export type CallCommandType = "INSTRUCTION" | "TAKEOVER" | "HANDBACK" | "END_CALL" | "STAFF_MESSAGE";

/** What the self-hosted voice pipeline used on a call; priced by `core` into `estimated_cost_usd`. */
export interface CallUsage {
  llm_input_tokens?: number;
  llm_output_tokens?: number;
  stt_audio_seconds?: number;
  tts_characters?: number;
}

/** 0 = not confirmed; 1 = name, date of birth and postcode; 2 = level 1 plus a question about recent activity. */
export type IdentityLevel = 0 | 1 | 2;
/** KNOWLEDGE: answered questions in conversation. APP_PUSH: the optional banking app check (level 1 only). */
export type IdentityMethod = "KNOWLEDGE" | "APP_PUSH";

export type CallHoldReason = "CHECKING_SYSTEM" | "WAITING_FOR_APP_APPROVAL";

/** The latest hold state kept on the call, so a page loaded mid-hold can show it. */
export interface CallHold {
  is_on_hold: boolean;
  reason: CallHoldReason;
  tool_name: string | null;
  started_at: string;
}

/** `call.hold`: the AI put the caller on hold while a tool checks the bank, or took them off hold. */
export interface CallHoldEvent extends CallHold {
  call_id: string;
  ended_at: string | null;
}

export interface CallMetrics {
  mode?: CallMode;
  response_times_ms?: number[];
  avg_response_ms?: number | null;
  time_to_identity_ms?: number | null;
  time_to_resolution_ms?: number | null;
  time_to_human_ms?: number | null;
  usage?: CallUsage;
  estimated_cost_usd?: number | null;
  hold?: CallHold | null;
  total_hold_ms?: number | null;
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
  /** Kept for older readers: true once identity_level >= 1. */
  identity_verified: boolean;
  identity_level: IdentityLevel;
  identity_method: IdentityMethod | null;
  is_identity_locked: boolean;
  /** Answers that did not match on this call, from engine.identity_attempts. */
  identity_failed_attempts?: number;
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

/** `GET /api/identity/calls/:call_id`: the api's authoritative identity record for one call. */
export interface CallIdentityRecord {
  call_id: string;
  identity_level: IdentityLevel;
  method: IdentityMethod | null;
  is_locked: boolean;
  failed_attempts: number;
  customer_id: string | null;
  /** The fraud case raised when the checks locked. */
  concern_case_number: string | null;
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

/** `core` took a line the caller typed; the voice agent records and answers it like speech. */
export interface CustomerMessageReceipt {
  is_accepted: true;
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

export type ToolCallResponse =
  | { ok: true; result: Record<string, unknown> }
  | { ok: false; error: { code: string; message: string } };

export interface VoiceModelStatus {
  model: string | null;
  is_reachable: boolean;
}

export interface VoiceStatus {
  is_live_available: boolean;
  unavailable_reason: string | null;
  /** Browser-facing LiveKit URL; null means ws://<page hostname>:7880. */
  livekit_url: string | null;
  /** LiveKit is up: staff can listen and talk even on scripted calls. */
  is_media_available: boolean;
  language_model: VoiceModelStatus;
  speech_to_text: VoiceModelStatus;
  text_to_speech: VoiceModelStatus & { ai_voice: string | null; staff_voice: string | null };
}

/** Everything a browser needs to join one call's LiveKit room. */
export interface CallRoomAccess {
  room_name: string;
  livekit_url: string | null;
  token: string;
  identity: string;
}

/** The customer's access to the call room. For a LIVE call, creating it also starts the AI voice agent. */
export interface VoiceSession extends CallRoomAccess {
  identity: "customer";
}

/** A staff member's access to the call room: listen-in, or talk after a takeover. */
export type StaffVoiceToken = CallRoomAccess;

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
