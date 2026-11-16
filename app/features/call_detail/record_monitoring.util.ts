import { recordIntervention } from "@/shared/api_client/core_api.client";

const MONITOR_REPEAT_WINDOW_MS = 60_000;
const last_recorded_at_ms = new Map<string, number>();

/**
 * Opening a call is itself an auditable act of oversight, logged as a MONITOR
 * intervention. Re-opening the same call within a minute is not logged again.
 * It fails harmlessly for a call that has already ended.
 */
export function recordMonitoring(call_id: string, staff_id: string): void {
  const monitoring_key = `${call_id}|${staff_id}`;
  const now_ms = Date.now();
  if (now_ms - (last_recorded_at_ms.get(monitoring_key) ?? 0) < MONITOR_REPEAT_WINDOW_MS) {
    return;
  }
  last_recorded_at_ms.set(monitoring_key, now_ms);
  recordIntervention(call_id, { staff_id, type: "MONITOR" }).catch(() => undefined);
}
