export interface NotificationRecord {
  notification_id: string;
  customer_id: string;
  call_id: string | null;
  case_number: string | null;
  channel: string;
  kind: string;
  body: string;
  status: string;
  created_at: Date;
  responded_at: Date | null;
}

export interface NewNotification {
  customer_id: string;
  call_id: string | null;
  case_number: string | null;
  // LETTER: the customer has turned SMS alerts off.
  channel: 'APP_PUSH' | 'SMS' | 'LETTER';
  kind: 'IDENTITY_CHECK' | 'CASE_UPDATE';
  body: string;
}

// What the SMS templates need to know about a case.
export interface CaseMessageContext {
  case_number: string;
  call_id: string | null;
  customer_id: string;
  action_code: string;
  tier: number;
  // The case status at the time of the message (AUTO_DECLINED, ...).
  status?: string;
  facts: Record<string, unknown>;
  params: Record<string, unknown>;
  response_due_on: string | null;
  execution_result: Record<string, unknown> | null;
  is_approved?: boolean;
}
