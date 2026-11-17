// A row of engine.calls (owned by the core service, read-only here) joined
// with the model and prompt version of the AI agent handling it.
export interface CallRecord {
  call_id: string;
  caller_number: string;
  customer_id: string | null;
  customer_name: string | null;
  channel: string;
  status: string;
  handled_by_agent_id: string | null;
  assigned_staff_id: string | null;
  identity_verified: boolean;
  // Written by core from the identity results; the api's own authority is
  // engine.identity_attempts.
  identity_level: number;
  identity_method: string | null;
  is_identity_locked: boolean;
  risk_level: string;
  started_at: Date;
  ended_at: Date | null;
  agent_model: string | null;
  agent_prompt_version: string | null;
}
