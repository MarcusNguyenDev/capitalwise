import { CallMetrics } from './call_metrics.type';
import { CallChannel } from './call_row.type';

export interface NewCall {
  caller_number: string;
  customer_id: string | null;
  customer_name: string | null;
  channel: CallChannel;
  handled_by_agent_id: string | null;
  metrics: CallMetrics;
}
