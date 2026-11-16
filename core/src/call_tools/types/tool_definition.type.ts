export type ToolName =
  | 'get_caller_context'
  | 'send_identity_push'
  | 'get_customer_overview'
  | 'get_recent_transactions'
  | 'get_fee_history'
  | 'get_income_summary'
  | 'get_loan_details'
  | 'get_held_payments'
  | 'lock_card'
  | 'propose_action'
  | 'request_human'
  | 'flag_concern'
  | 'update_call_insight';

export interface JsonSchemaObject {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
}

export interface ToolDefinition {
  name: ToolName;
  description: string;
  parameters: JsonSchemaObject;
  // class-validator DTO the arguments are validated against server-side.
  args_dto: new () => object;
  requires_verified_identity: boolean;
  requires_matched_customer: boolean;
}

// OpenAI Realtime `tools` entry.
export interface RealtimeToolDefinition {
  type: 'function';
  name: ToolName;
  description: string;
  parameters: JsonSchemaObject;
}
