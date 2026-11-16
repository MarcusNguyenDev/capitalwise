import { getCoreBaseUrl } from "@/shared/config/service_urls.config";
import { requestJson } from "@/shared/http/request_json.util";
import type {
  CallChannel,
  CallDetail,
  CallMode,
  CallScript,
  CallScriptSummary,
  CallTurn,
  Intervention,
  InterventionType,
  LiveCall,
  SimulatorStatus,
  StaffVoiceToken,
  ToolCallResponse,
  VoiceSession,
  VoiceStatus,
} from "@/shared/types/call.type";

/** Client for the `core` service (phone call and AI runtime). */

function callCore<ResponseBody>(request: {
  path: string;
  method?: "GET" | "POST";
  query?: object;
  body?: unknown;
}): Promise<ResponseBody> {
  return requestJson<ResponseBody>({ base_url: getCoreBaseUrl(), ...request, path: `/core${request.path}` });
}

// Calls
export const fetchLiveCalls = () => callCore<LiveCall[]>({ path: "/calls" });
export const fetchCallDetail = (call_id: string) => callCore<CallDetail>({ path: `/calls/${call_id}` });
export const startCall = (call_request: { caller_number: string; channel: CallChannel; mode?: CallMode }) =>
  callCore<LiveCall>({ path: "/calls", method: "POST", body: call_request });
export const endCall = (call_id: string, ended_by: "CUSTOMER" | "AI" | "STAFF" | "SYSTEM", staff_id?: string) =>
  callCore<LiveCall>({ path: `/calls/${call_id}/end`, method: "POST", body: { ended_by, staff_id } });
export const recordTurn = (call_id: string, turn: { speaker: "CUSTOMER" | "AI" | "STAFF"; text: string; latency_ms?: number }) =>
  callCore<CallTurn>({ path: `/calls/${call_id}/turns`, method: "POST", body: turn });
export const callTool = (call_id: string, tool_name: string, args: Record<string, unknown>) =>
  callCore<ToolCallResponse>({ path: `/calls/${call_id}/tools/${tool_name}`, method: "POST", body: { args } });

// Supervisor controls
export const recordIntervention = (
  call_id: string,
  intervention: { staff_id: string; type: InterventionType; text?: string },
) => callCore<Intervention>({ path: `/calls/${call_id}/interventions`, method: "POST", body: intervention });
export const confirmInstructionApplied = (call_id: string, intervention_id: string) =>
  callCore<Record<string, unknown>>({ path: `/calls/${call_id}/interventions/${intervention_id}/applied`, method: "POST", body: {} });
export const sendStaffMessage = (call_id: string, staff_message: { staff_id: string; text: string }) =>
  callCore<CallTurn>({ path: `/calls/${call_id}/staff_messages`, method: "POST", body: staff_message });

// Voice (call audio runs over LiveKit; these mint room access)
export const fetchVoiceStatus = () => callCore<VoiceStatus>({ path: "/voice/status" });
/** The customer's room token. For a LIVE call this also starts the AI voice agent. */
export const createVoiceSession = (call_id: string) =>
  callCore<VoiceSession>({ path: "/voice/sessions", method: "POST", body: { call_id } });
/** `can_publish` false listens in; true lets the staff member who took over talk. */
export const createStaffVoiceToken = (staff_token_request: { call_id: string; staff_id: string; can_publish: boolean }) =>
  callCore<StaffVoiceToken>({ path: "/voice/staff_tokens", method: "POST", body: staff_token_request });

// Scripted hero calls
export const fetchScriptedCalls = () => callCore<CallScriptSummary[]>({ path: "/scripted_calls" });
export const fetchScriptedCall = (customer_id: string) => callCore<CallScript>({ path: `/scripted_calls/${customer_id}` });

// Simulator
export const fetchSimulatorStatus = () => callCore<SimulatorStatus>({ path: "/simulator/status" });
export const startSimulator = (call_count: number, speed: 1 | 2) =>
  callCore<SimulatorStatus>({ path: "/simulator/start", method: "POST", body: { call_count, speed } });
export const stopSimulator = () => callCore<SimulatorStatus>({ path: "/simulator/stop", method: "POST", body: {} });
export const setSimulatorSpeed = (speed: 1 | 2) =>
  callCore<SimulatorStatus>({ path: "/simulator/speed", method: "POST", body: { speed } });
