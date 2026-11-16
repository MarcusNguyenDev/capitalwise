export type NotificationStatus = 'SENT' | 'APPROVED' | 'DENIED' | 'EXPIRED';

export interface EngineNotification {
  notification_id: string;
  customer_id: string;
  call_id: string | null;
  case_number: string | null;
  channel: string;
  kind: string;
  body: string;
  status: NotificationStatus;
  created_at: string;
  responded_at: string | null;
}
