import { CallRow } from './call_row.type';

// Row shape of engine.v_live_calls (the same columns are computed for ended calls).
export interface LiveCall extends CallRow {
  agent_name: string | null;
  assigned_staff_name: string | null;
  last_line: string | null;
  last_speaker: string | null;
  duration_seconds: number;
}
