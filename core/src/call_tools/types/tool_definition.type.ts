export type ToolName =
  | 'get_caller_context'
  | 'start_identity_check'
  | 'submit_identity_answers'
  | 'send_app_identity_check'
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
  // The identity level core checks before the tool runs (the api enforces
  // it too). For propose_action the api checks the level of each action.
  required_identity_level: 0 | 1 | 2;
  // The call must be linked to a customer: by caller ID, or by passed answers.
  requires_matched_customer: boolean;
}
