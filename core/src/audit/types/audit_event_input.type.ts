export type CoreAuditEventType =
  'TOOL_CALL' | 'INSTRUCTION_APPLIED' | 'TAKEOVER' | 'HANDBACK' | 'CALL_ENDED';

export interface AuditEventInput {
  event_type: CoreAuditEventType;
  call_id: string;
  case_number?: string | null;
  detail: Record<string, unknown>;
}
