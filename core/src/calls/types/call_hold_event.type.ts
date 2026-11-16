import { CallHoldReason } from './call_metrics.type';

// Payload of the `call.hold` live event (rooms `staff` and `call:<id>`).
export interface CallHoldEvent {
  call_id: string;
  is_on_hold: boolean;
  reason: CallHoldReason;
  tool_name: string;
  started_at: string;
  ended_at: string | null;
}
